<?php

// Indonesian validation messages for the rules used by PM-App.
return [
    'after' => ':attribute harus tanggal setelah :date.',
    'array' => ':attribute harus berupa daftar.',
    'boolean' => ':attribute harus bernilai benar atau salah.',
    'date' => ':attribute bukan tanggal yang valid.',
    'date_format' => ':attribute tidak sesuai format :format.',
    'digits_between' => ':attribute harus terdiri dari :min sampai :max digit.',
    'distinct' => ':attribute memiliki nilai duplikat.',
    'email' => ':attribute harus alamat email yang valid.',
    'exists' => ':attribute yang dipilih tidak valid.',
    'file' => ':attribute harus berupa berkas.',
    'gt' => [
        'numeric' => ':attribute harus lebih besar dari :value.',
    ],
    'in' => ':attribute yang dipilih tidak valid.',
    'integer' => ':attribute harus berupa bilangan bulat.',
    'max' => [
        'numeric' => ':attribute tidak boleh lebih dari :max.',
        'file' => ':attribute tidak boleh lebih dari :max kilobyte.',
        'string' => ':attribute tidak boleh lebih dari :max karakter.',
        'array' => ':attribute tidak boleh lebih dari :max item.',
    ],
    'mimes' => ':attribute harus berkas bertipe: :values.',
    'min' => [
        'numeric' => ':attribute minimal :min.',
        'file' => ':attribute minimal :min kilobyte.',
        'string' => ':attribute minimal :min karakter.',
        'array' => ':attribute minimal :min item.',
    ],
    'numeric' => ':attribute harus berupa angka.',
    'present' => ':attribute wajib ada.',
    'required' => ':attribute wajib diisi.',
    'required_if' => ':attribute wajib diisi bila :other adalah :value.',
    'required_without' => ':attribute wajib diisi bila :values tidak diisi.',
    'size' => [
        'numeric' => ':attribute harus berukuran :size.',
        'array' => ':attribute harus berisi :size item.',
        'string' => ':attribute harus :size karakter.',
    ],
    'string' => ':attribute harus berupa teks.',
    'uuid' => ':attribute harus UUID yang valid.',

    'custom' => [],

    'attributes' => [
        'materials.*.material_name' => 'nama material',
        'materials.*.quantity' => 'jumlah material',
        'materials.*.unit' => 'satuan',
        'labours.*.worker_name' => 'nama pekerja',
        'labours.*.started_at' => 'jam mulai',
        'labours.*.finished_at' => 'jam selesai',
        'clearance.*.item_no' => 'nomor item clearance',
        'clearance.*.result' => 'hasil clearance',
    ],

    'values' => [
        'acceptance' => ['yes' => 'Yes', 'no' => 'No'],
    ],
];
