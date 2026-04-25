alter table public.profiles enable row level security;
alter table public.follows enable row level security;
alter table public.posts enable row level security;
alter table public.blocks enable row level security;

-- Profiles
create policy "Profiles are viewable by everyone"
  on public.profiles for select using (true);

create policy "Users can update own profile"
  on public.profiles for update using (auth.uid() = id);

-- Follows
create policy "Anyone can view follows"
  on public.follows for select using (true);

create policy "Authenticated users can follow"
  on public.follows for insert with check (auth.uid() = follower_id);

create policy "Users can unfollow"
  on public.follows for delete using (auth.uid() = follower_id);

-- Posts
create policy "Published posts are viewable"
  on public.posts for select using (
    is_published = true or user_id = auth.uid()
  );

create policy "Users can insert own posts"
  on public.posts for insert with check (auth.uid() = user_id);

create policy "Users can update own posts"
  on public.posts for update using (auth.uid() = user_id);

create policy "Users can delete own posts"
  on public.posts for delete using (auth.uid() = user_id);

-- Blocks
create policy "Blocks are viewable if post is viewable"
  on public.blocks for select using (
    exists (
      select 1 from public.posts
      where posts.id = blocks.post_id
      and (posts.is_published = true or posts.user_id = auth.uid())
    )
  );

create policy "Users can insert blocks on own posts"
  on public.blocks for insert with check (
    exists (
      select 1 from public.posts
      where posts.id = blocks.post_id and posts.user_id = auth.uid()
    )
  );

create policy "Users can update blocks on own posts"
  on public.blocks for update using (
    exists (
      select 1 from public.posts
      where posts.id = blocks.post_id and posts.user_id = auth.uid()
    )
  );

create policy "Users can delete blocks on own posts"
  on public.blocks for delete using (
    exists (
      select 1 from public.posts
      where posts.id = blocks.post_id and posts.user_id = auth.uid()
    )
  );
