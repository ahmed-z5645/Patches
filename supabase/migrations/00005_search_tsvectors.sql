-- Full-text search vectors for profiles
alter table public.profiles add column search_vector tsvector
  generated always as (
    setweight(to_tsvector('english', coalesce(username, '')), 'A') ||
    setweight(to_tsvector('english', coalesce(display_name, '')), 'A') ||
    setweight(to_tsvector('english', coalesce(bio, '')), 'B')
  ) stored;

create index idx_profiles_search on public.profiles using gin(search_vector);

-- Full-text search vectors for posts (title + markdown block text stored denormalized)
alter table public.posts add column search_vector tsvector;

create index idx_posts_search on public.posts using gin(search_vector);

-- Function to rebuild a post's search vector from its title + markdown blocks
create or replace function public.update_post_search_vector()
returns trigger as $$
declare
  combined text;
begin
  select string_agg(b.content->>'markdown', ' ')
  into combined
  from public.blocks b
  where b.post_id = new.id and b.type = 'markdown';

  new.search_vector :=
    setweight(to_tsvector('english', coalesce(new.title, '')), 'A') ||
    setweight(to_tsvector('english', coalesce(combined, '')), 'B');

  return new;
end;
$$ language plpgsql;

create trigger trg_posts_search_vector
  before insert or update of title on public.posts
  for each row execute function public.update_post_search_vector();

-- Function to update post search vector when blocks change
create or replace function public.update_post_search_vector_from_block()
returns trigger as $$
declare
  post_row public.posts%rowtype;
  combined text;
  pid uuid;
begin
  pid := coalesce(new.post_id, old.post_id);

  select * into post_row from public.posts where id = pid;
  if not found then return coalesce(new, old); end if;

  select string_agg(b.content->>'markdown', ' ')
  into combined
  from public.blocks b
  where b.post_id = pid and b.type = 'markdown';

  update public.posts set search_vector =
    setweight(to_tsvector('english', coalesce(post_row.title, '')), 'A') ||
    setweight(to_tsvector('english', coalesce(combined, '')), 'B')
  where id = pid;

  return coalesce(new, old);
end;
$$ language plpgsql;

create trigger trg_blocks_update_post_search
  after insert or update of content or delete on public.blocks
  for each row execute function public.update_post_search_vector_from_block();

-- Backfill existing posts
update public.posts set search_vector =
  setweight(to_tsvector('english', coalesce(title, '')), 'A') ||
  setweight(to_tsvector('english', coalesce((
    select string_agg(b.content->>'markdown', ' ')
    from public.blocks b
    where b.post_id = posts.id and b.type = 'markdown'
  ), '')), 'B');
