create extension if not exists "uuid-ossp";

-- Profiles (extends auth.users)
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text unique not null,
  display_name text,
  bio text,
  is_public boolean default false,
  avatar_url text,
  streak_count int default 0,
  streak_shields_available int default 0,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Follower graph
create table public.follows (
  follower_id uuid references public.profiles(id) on delete cascade,
  following_id uuid references public.profiles(id) on delete cascade,
  created_at timestamptz default now(),
  primary key (follower_id, following_id),
  constraint no_self_follow check (follower_id <> following_id)
);

-- Weekly posts
create table public.posts (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references public.profiles(id) on delete cascade not null,
  week_number int not null,
  year int not null,
  title text,
  is_published boolean default false,
  is_late boolean default false,
  word_count int default 0,
  published_at timestamptz,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique (user_id, week_number, year)
);

-- Content blocks (artifacts)
create table public.blocks (
  id uuid primary key default uuid_generate_v4(),
  post_id uuid references public.posts(id) on delete cascade not null,
  parent_block_id uuid references public.blocks(id) on delete set null,
  type text not null check (type in ('markdown', 'image', 'spotify', 'strava', 'map', 'code', 'weather')),
  content jsonb default '{}'::jsonb,
  grid_layout_desktop jsonb default '{"colStart": 1, "colSpan": 1, "rowStart": 1, "rowSpan": 2}'::jsonb,
  grid_layout_mobile jsonb default '{"order": 0, "colSpan": 1}'::jsonb,
  float_position text check (float_position in ('left', 'right', 'center')),
  z_index int default 0,
  sort_order int default 0,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Indexes
create index idx_posts_user_week on public.posts(user_id, week_number, year);
create index idx_posts_published on public.posts(is_published, week_number, year);
create index idx_blocks_post on public.blocks(post_id);
create index idx_blocks_parent on public.blocks(parent_block_id);
create index idx_follows_follower on public.follows(follower_id);
create index idx_follows_following on public.follows(following_id);
create index idx_profiles_username on public.profiles(username);

-- Auto-update timestamps
create or replace function public.handle_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger set_profiles_updated_at
  before update on public.profiles
  for each row execute function public.handle_updated_at();

create trigger set_posts_updated_at
  before update on public.posts
  for each row execute function public.handle_updated_at();

create trigger set_blocks_updated_at
  before update on public.blocks
  for each row execute function public.handle_updated_at();

-- Auto-create profile on signup
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, username, display_name, avatar_url)
  values (
    new.id,
    new.raw_user_meta_data->>'username',
    coalesce(new.raw_user_meta_data->>'display_name', new.raw_user_meta_data->>'username'),
    new.raw_user_meta_data->>'avatar_url'
  );
  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
