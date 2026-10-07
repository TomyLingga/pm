<?php

// Business rules of PM-App (see docs/PRD.md and docs/STATE_MACHINES.md).
return [
    // Portal grade codes that act as executor leads (receive/assign WO, approve, PM schedule).
    // Technicians are the grade below them (BOM-4).
    'lead_grade_codes' => array_filter(explode(',', env('PM_LEAD_GRADE_CODES', 'BOM,BOM-1,BOM-2,BOM-3'))),

    // NRKs that receive the admin role automatically when they log in (first admin of a fresh install).
    'bootstrap_admin_nrks' => array_values(array_filter(array_map('trim', explode(',', (string) env('PM_BOOTSTRAP_ADMIN_NRKS', ''))))),

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

    'service_request' => [
        // Approvers waiting longer than this get an alarm reminder (repeated every interval).
        'reminder_hours' => (int) env('PM_APPROVAL_REMINDER_HOURS', 24),

        'document' => [
            'company' => 'PT. INDUSTRI NABATI LESTARI',
            'subtitle' => 'PABRIK MINYAK GORENG',
            'address' => 'Kantor Pusat : Komp. KEK Sei Mangkei, Kav.2-3, Kec. Bosar Maligas, Kab. Simalungun, Sumatera Utara, 21184',
            'title' => 'FORM REQUEST',
            'number' => env('PM_REQ_DOC_NUMBER', 'INLHO/BSIS-ITC/F-004'),
            'effective_date' => env('PM_REQ_DOC_EFFECTIVE_DATE', '04-Mei-22'),
            'revision' => env('PM_REQ_DOC_REVISION', '01'),
            'version_note' => env('PM_REQ_DOC_VERSION_NOTE', 'versi dokumen : 1/Agustus 2019'),
        ],
    ],

    // Preventive Maintenance scheduler
    'preventive' => [
        // A task becomes JATUH_TEMPO (and the PIC is reminded) this long before due_at. 48 = H-2, 72 = H-3.
        'due_window_hours' => (int) env('PM_DUE_WINDOW_HOURS', 48),
        // Overdue tasks are re-announced at this interval.
        'overdue_reminder_hours' => (int) env('PM_OVERDUE_REMINDER_HOURS', 48),
        // How far ahead pm:generate-tasks creates tasks.
        'horizon_days' => (int) env('PM_HORIZON_DAYS', 60),
        'horizon_days_hourly' => (int) env('PM_HORIZON_DAYS_HOURLY', 7),
        'max_task_photos' => 10,
        'max_item_photos' => 5,
    ],

    'attachments' => [
        'disk' => env('PM_ATTACHMENT_DISK', 'local'),
        'max_files' => 10,
        'max_kb' => 5120,
        'mimes' => ['jpg', 'jpeg', 'png', 'webp', 'pdf'],
    ],

    // Public web URL used inside QR codes on printed documents.
    'web_url' => rtrim(env('PM_WEB_URL', env('APP_URL', 'http://localhost:3000')), '/'),

    'notifications' => [
        // E-mail is an optional extra channel (Q-26 chose push + alarm); off unless SMTP is configured.
        'mail' => (bool) env('PM_MAIL_NOTIFICATIONS', false),
    ],

    'live_board' => [
        // PM tasks still TERJADWAL whose due time is within this many hours show on the live board
        'upcoming_hours' => (int) env('PM_LIVE_UPCOMING_HOURS', 48),
    ],

    'dashboard' => [
        // Aggregates are cached per (user, scope, filters) for this many seconds (0 = no cache).
        'cache_seconds' => (int) env('PM_DASHBOARD_CACHE_SECONDS', 300),
        'max_period_days' => 366,
    ],

    'push' => [
        'expo_url' => env('EXPO_PUSH_URL', 'https://exp.host/--/api/v2/push/send'),
        'expo_access_token' => env('EXPO_ACCESS_TOKEN'),
    ],
];
