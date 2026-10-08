-- Update e-money product metadata to match the current 4-template KM11 design set.
update public.products
set description = 'Katalog kartu e-money custom. Customer dapat memilih 1 dari 4 template, upload foto, mengatur posisi foto/nama, menyetujui preview, lalu hasil PNG final akan tersimpan untuk admin cetak.',
    image_url = '/emoney/front-templates.png',
    specifications = coalesce(specifications, '{}'::jsonb)
      || jsonb_build_object(
          'Format', 'Custom e-money card',
          'Preview', 'PNG final tersimpan',
          'Template', '4 pilihan template'
        )
where slug = 'kartu-emoney-custom-km11';
