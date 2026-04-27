alter table public.posts add column cover_color text;
alter table public.posts add column tags text[] default '{}';
