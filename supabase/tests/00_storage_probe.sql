-- TEMPORARY (spec 012, task 1): checks whether the throwaway CI database built
-- by `supabase db start` has the Storage tables the shop-logos migration needs.
-- Delete this file once the answer is recorded in specs/012-shop-branding/tasks.md.
begin;
select * from no_plan();

select has_table('storage', 'buckets', 'storage.buckets exists in the CI database');
select has_table('storage', 'objects', 'storage.objects exists in the CI database');

select * from finish();
rollback;
