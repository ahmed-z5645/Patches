-- Check if a user has unlocked the feed for a given week
create or replace function public.has_unlocked_week(
  p_user_id uuid,
  p_week_number int,
  p_year int
)
returns boolean as $$
begin
  return exists (
    select 1 from public.posts
    where user_id = p_user_id
    and week_number = p_week_number
    and year = p_year
    and is_published = true
    and word_count >= 100
    and title is not null
    and title <> ''
  );
end;
$$ language plpgsql stable security definer;
