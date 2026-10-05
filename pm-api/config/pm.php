<?php

// Business rules of PM-App (see docs/PRD.md and docs/STATE_MACHINES.md).
return [
    // Portal grade codes that act as executor leads (receive/assign WO, approve, PM schedule).
    // Technicians are the grade below them (BOM-4).
    'lead_grade_codes' => array_filter(explode(',', env('PM_LEAD_GRADE_CODES', 'BOM,BOM-1,BOM-2,BOM-3'))),

    // ISO-8601 day numbers (1 = Monday … 7 = Sunday) counted as working days.
    'working_days' => array_map('intval', explode(',', env('PM_WORKING_DAYS', '1,2,3,4,5'))),

    'work_order' => [
        // Completed WOs not answered by the user are auto-accepted after this many working days.
        'auto_accept_working_days' => (int) env('PM_WO_AUTO_ACCEPT_DAYS', 3),

        'clearance_items' => [
            1 => 'Area bersih',
            2 => 'Tidak ada tools dan atau material yang tertinggal di area kerja',
        ],

        'document' => [
            'company' => 'PT. INDUSTRI NABATI LESTARI',
            'subtitle' => 'PABRIK MINYAK GORENG',
            'address' => 'Komp.KEK Sei Mangkei, Kav.2-3, Kec. Bosar Maligas, Kab. Simalungun, Sumatera Utara, 21183',
            'title' => 'FORMULIR WORK ORDER',
            'number' => env('PM_WO_DOC_NUMBER', 'FM-BOPS-10/05'),
            'effective_date' => env('PM_WO_DOC_EFFECTIVE_DATE', '09-Sept-25'),
            'revision' => env('PM_WO_DOC_REVISION', '01'),
        ],
    ],

    'attachments' => [
        'disk' => env('PM_ATTACHMENT_DISK', 'local'),
        'max_files' => 10,
        'max_kb' => 5120,
        'mimes' => ['jpg', 'jpeg', 'png', 'webp', 'pdf'],
    ],

    // Public web URL used inside QR codes on printed documents.
    'web_url' => rtrim(env('PM_WEB_URL', env('APP_URL', 'http://localhost:3000')), '/'),

    'push' => [
        'expo_url' => env('EXPO_PUSH_URL', 'https://exp.host/--/api/v2/push/send'),
        'expo_access_token' => env('EXPO_ACCESS_TOKEN'),
    ],
];
