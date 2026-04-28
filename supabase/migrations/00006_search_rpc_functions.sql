-- Search users by username or display_name prefix
create or replace function public.search_users(query_text text, caller_id uuid)
returns table (
  id uuid,
  username text,
  display_name text,
  bio text,
  avatar_url text,
  is_following boolean
) as $$
declare
  pattern text := lower(query_text) || '%';
begin
  return query
    select
      p.id,
      p.username,
      p.display_name,
      p.bio,
      p.avatar_url,
      exists(
        select 1 from public.follows f
        where f.follower_id = caller_id and f.following_id = p.id
      ) as is_following
    from public.profiles p
    where p.id != caller_id
      and (
        lower(p.username) like pattern
        or lower(p.display_name) like pattern
      )
    order by
      case when lower(p.username) = lower(query_text) then 0
           when lower(p.username) like pattern then 1
           else 2
      end
    limit 20;
end;
$$ language plpgsql stable security definer;

-- Search published posts from users the caller follows
create or replace function public.search_posts(query_text text, caller_id uuid)
returns table (
  id uuid,
  user_id uuid,
  title text,
  week_number int,
  year int,
  word_count int,
  cover_color text,
  tags text[],
  is_late boolean,
  published_at timestamptz,
  username text,
  display_name text,
  avatar_url text,
  rank real
) as $$
begin
  return query
    select
      po.id,
      po.user_id,
      po.title,
      po.week_number,
      po.year,
      po.word_count,
      po.cover_color,
      po.tags,
      po.is_late,
      po.published_at,
      pr.username,
      pr.display_name,
      pr.avatar_url,
      ts_rank(po.search_vector, websearch_to_tsquery('english', query_text)) as rank
    from public.posts po
    join public.follows fw on fw.follower_id = caller_id and fw.following_id = po.user_id
    join public.profiles pr on pr.id = po.user_id
    where po.is_published = true
      and po.search_vector @@ websearch_to_tsquery('english', query_text)
    order by rank desc
    limit 20;
end;
$$ language plpgsql stable security definer;
