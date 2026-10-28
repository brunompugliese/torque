-- Shop branding: address, phone, logo path and the private logos bucket (spec 012).
begin;
\ir _fixtures.psql
select * from no_plan();

-- -----------------------------------------------------------------------------
-- Structure and setup (as admin, like the dashboard)
-- -----------------------------------------------------------------------------
select has_column('public', 'shop', 'address', 'shop has an address');
select has_column('public', 'shop', 'phone', 'shop has a phone');
select has_column('public', 'shop', 'logo_path', 'shop has a logo path');
select col_is_null('public', 'shop', 'logo_path', 'the logo is optional');

select tests.act_as_admin();

select lives_ok(
  format($$ update public.shop set address = 'Calle Falsa 123', phone = '11 5555-0101', logo_path = %L where id = tests.id('shop_a') $$,
         tests.id('shop_a') || '/logo.png'),
  'a logo inside the shop''s own folder is accepted');
select lives_ok(
  format($$ update public.shop set address = 'Avenida Ficticia 456', phone = '11 5555-0201', logo_path = %L where id = tests.id('shop_b') $$,
         tests.id('shop_b') || '/logo.png'),
  'shop B''s logo inside its own folder is accepted');

select throws_ok(
  format($$ update public.shop set logo_path = %L where id = tests.id('shop_a') $$, tests.id('shop_b') || '/logo.png'),
  '23514', null, 'a logo in another shop''s folder is rejected');
select throws_ok(
  $$ update public.shop set logo_path = 'logo.png' where id = tests.id('shop_a') $$,
  '23514', null, 'a logo outside any shop folder is rejected');
select lives_ok(
  $$ update public.shop set logo_path = null where id = tests.id('shop_a') $$,
  'the logo can be removed');
select lives_ok(
  format($$ update public.shop set logo_path = %L where id = tests.id('shop_a') $$, tests.id('shop_a') || '/logo.png'),
  'and put back');

-- -----------------------------------------------------------------------------
-- The bucket
-- -----------------------------------------------------------------------------
select is((select public from storage.buckets where id = 'shop-logos'), false, 'the bucket is private');
select is((select file_size_limit from storage.buckets where id = 'shop-logos'), 524288::bigint, 'the bucket limits files to 512 KB');
select is((select allowed_mime_types from storage.buckets where id = 'shop-logos'),
          array['image/png', 'image/jpeg', 'image/webp'], 'the bucket accepts PNG, JPG and WebP only');

-- One logo per shop, plus a file in another bucket under shop A's folder.
insert into storage.buckets (id, name) values ('other-bucket', 'other-bucket');
insert into storage.objects (bucket_id, name) values
  ('shop-logos', tests.id('shop_a') || '/logo.png'),
  ('shop-logos', tests.id('shop_b') || '/logo.png'),
  ('other-bucket', tests.id('shop_a') || '/other.png');

-- -----------------------------------------------------------------------------
-- Reading the shop row
-- -----------------------------------------------------------------------------
select tests.act_as('user_a');
select results_eq($$ select id from public.shop $$, $$ select tests.id('shop_a') $$, 'a user sees only their own shop');
select is((select address || '|' || phone || '|' || logo_path from public.shop),
          'Calle Falsa 123|11 5555-0101|' || tests.id('shop_a') || '/logo.png', 'and its address, phone and logo path');

select tests.act_as('user_b');
select is((select address from public.shop), 'Avenida Ficticia 456', 'shop B sees its own address');

select tests.act_as('user_a_off');
select is((select count(*)::int from public.shop), 0, 'a disabled profile sees no shop');

select tests.act_as_anon();
select throws_ok($$ select address from public.shop $$, '42501', null, 'anon can''t read shops');

select tests.act_as('user_a');
select throws_ok($$ update public.shop set address = 'Otra 1' where id = tests.id('shop_a') $$, '42501', null,
                 'a user can''t change their shop''s address');
select throws_ok($$ update public.shop set logo_path = null where id = tests.id('shop_a') $$, '42501', null,
                 'a user can''t change their shop''s logo');

-- -----------------------------------------------------------------------------
-- Reading the logo files
-- -----------------------------------------------------------------------------
select tests.act_as('user_a');
select results_eq($$ select name from storage.objects where bucket_id = 'shop-logos' $$,
                  format($$ values (%L) $$, tests.id('shop_a') || '/logo.png'),
                  'a user reads only their own shop''s logo');
select is((select count(*)::int from storage.objects where bucket_id = 'other-bucket'), 0,
          'and nothing from other buckets, even under their shop''s folder');

select tests.act_as('user_b');
select results_eq($$ select name from storage.objects where bucket_id = 'shop-logos' $$,
                  format($$ values (%L) $$, tests.id('shop_b') || '/logo.png'),
                  'shop B reads only its own logo');

select tests.act_as('user_a_off');
select is((select count(*)::int from storage.objects where bucket_id = 'shop-logos'), 0, 'a disabled profile reads no logo');

select tests.act_as_anon();
select is((select count(*)::int from storage.objects where bucket_id = 'shop-logos'), 0, 'anon reads no logo');

-- -----------------------------------------------------------------------------
-- Nobody writes through the API
-- -----------------------------------------------------------------------------
select tests.act_as('user_a');
select throws_ok(
  format($$ insert into storage.objects (bucket_id, name) values ('shop-logos', %L) $$, tests.id('shop_a') || '/mine.png'),
  '42501', null, 'a user can''t upload a logo');

-- Storage may refuse direct updates and deletes with an error or just match no
-- row; either way the file must be unchanged afterwards.
do $$
begin
  update storage.objects set name = tests.id('shop_a') || '/hacked.png'
  where bucket_id = 'shop-logos' and name = tests.id('shop_a') || '/logo.png';
exception when others then
  null;
end $$;
do $$
begin
  delete from storage.objects where bucket_id = 'shop-logos' and name = tests.id('shop_a') || '/logo.png';
exception when others then
  null;
end $$;

select tests.act_as_admin();
select is((select count(*)::int from storage.objects where bucket_id = 'shop-logos' and name = tests.id('shop_a') || '/logo.png'), 1,
          'a user can''t rename or delete a logo');

select * from finish();
rollback;
