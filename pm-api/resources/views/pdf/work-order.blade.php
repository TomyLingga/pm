@php
    /** @var \App\Models\WorkOrder $wo */
    $fmtDate = fn ($d) => $d ? $d->timezone(config('app.timezone'))->translatedFormat('d M Y') : '';
    $fmtTime = fn ($d) => $d ? $d->timezone(config('app.timezone'))->format('H:i') : '';
    $fmtDateTime = fn ($d) => $d ? $d->timezone(config('app.timezone'))->translatedFormat('d M Y H:i') : '';
    $box = fn (bool $checked) => '<span class="box">'.($checked ? 'X' : '&nbsp;').'</span>';
    $clearanceText = function ($result, $by, $at) use ($fmtDate) {
        if (! $result) {
            return '<span class="muted">OK/TDK* ......./......./.......</span>';
        }
        $label = $result === 'ok' ? 'OK' : 'TDK';

        return '<b>'.$label.'</b> / '.e($by?->name ?? '-').' / '.$fmtDate($at);
    };
    $materials = $wo->materials->values();
    $labours = $wo->labours->values();
    $deptSection = collect([$wo->requester_sub_bagian_name, $wo->requester_org_unit_name])->filter()->unique()->join(' / ');
@endphp
<!DOCTYPE html>
<html lang="id">
<head>
<meta charset="utf-8">
<title>{{ $wo->wo_number }}</title>
<style>
    @page { margin: 22px 32px 26px 32px; }
    * { box-sizing: border-box; }
    body { font-family: Helvetica, Arial, sans-serif; font-size: 8.4pt; color: #000; margin: 0; }
    table { width: 100%; border-collapse: collapse; table-layout: fixed; }
    td, th { border: 0.8px solid #000; padding: 3px 4px; vertical-align: top; word-wrap: break-word; }
    .noborder td { border: none; }
    .center { text-align: center; }
    .middle { vertical-align: middle; }
    .bold { font-weight: bold; }
    .en { font-style: italic; font-size: 7.4pt; }
    .muted { color: #555; }
    .small { font-size: 7.2pt; }
    .tiny { font-size: 6.4pt; }
    .yellow { background: #FFFF00; }
    .box { display: inline-block; width: 9px; height: 9px; border: 0.8px solid #000; font-size: 7pt; line-height: 9px; text-align: center; font-weight: bold; margin-right: 3px; vertical-align: middle; }
    .header td { padding: 4px; }
    .company { font-size: 11pt; font-weight: bold; text-decoration: underline; }
    .title { font-size: 11pt; font-weight: bold; letter-spacing: 0.5px; }
    .text-block { min-height: 70px; white-space: pre-wrap; }
    .sign { text-align: center; vertical-align: top; height: 92px; }
    .sign img { width: 62px; height: 62px; }
    .sign .name { font-weight: bold; margin-top: 2px; }
    .gap { height: 6px; border: none; }
    .notes td { border: none; padding: 0.5px 0; }
    /* dompdf sizes fixed tables from the first row, so each table starts with an invisible sizer row */
    tr.sizer td { border: none; padding: 0; height: 0; line-height: 0; font-size: 0; }
</style>
</head>
<body>

{{-- Document header (No. Dokumen / Tanggal Berlaku / Revisi / Halaman) --}}
<table class="header">
    <tr class="sizer"><td style="width:17.4%"></td><td style="width:52.4%"></td><td style="width:15.1%"></td><td style="width:15.1%"></td></tr>
    <tr>
        <td rowspan="4" class="center middle">
            @if ($logo)<img src="{{ $logo }}" style="width:96px">@endif
        </td>
        <td rowspan="3" class="center middle">
            <div class="company">{{ $doc['company'] }}</div>
            <div class="bold">{{ $doc['subtitle'] }}</div>
            <div class="small">{{ $doc['address'] }}</div>
        </td>
        <td class="small">Nomor Dokumen</td>
        <td class="small bold">{{ $doc['number'] }}</td>
    </tr>
    <tr><td class="small">Tanggal Berlaku</td><td class="small">{{ $doc['effective_date'] }}</td></tr>
    <tr><td class="small">Nomor Revisi</td><td class="small">{{ $doc['revision'] }}</td></tr>
    <tr>
        <td class="center middle title">{{ $doc['title'] }}</td>
        <td class="small">Halaman</td>
        <td class="small">1 dari 1</td>
    </tr>
</table>

<div style="height:6px"></div>

<table>
    <tr class="sizer"><td style="width:39.6%"></td><td style="width:60.4%"></td></tr>
    <tr>
        <td><b>Department/Section :</b> {{ $deptSection }}</td>
        <td>
            <b>No.WO :</b> {{ $wo->wo_number }}
            &nbsp;&nbsp;&nbsp;<b>Date :</b> {{ $fmtDateTime($wo->issued_at) }}
        </td>
    </tr>
</table>

{{-- Kategori: categories configured by the executor section --}}
<table class="noborder" style="margin: 4px 0">
    <tr>
        <td>
            <b>Katagori/Category :</b>&nbsp;
            @foreach ($categories as $category)
                <span style="margin-right:10px">{!! $box((int) $category->id === (int) $wo->service_category_id) !!}{{ $category->name }}</span>
            @endforeach
            @if ($wo->category_note)
                <span>: <u>{{ $wo->category_note }}</u></span>
            @endif
            <span class="muted small">&nbsp;(Pelaksana: {{ $wo->executorUnit->display_name }})</span>
        </td>
    </tr>
</table>

{{-- Main body: 11-column grid mirroring the Word table --}}
<table>
    <tr class="sizer">
        @foreach ([24.1, 9.5, 7.6, 0.5, 3.5, 16.7, 1.5, 5.3, 6.5, 6.5, 18.3] as $w)<td style="width:{{ $w }}%"></td>@endforeach
    </tr>

    <tr>
        <td colspan="3"><b>No. Alat/</b><span class="en">Equip No</span> : {{ $wo->equipment_code }}</td>
        <td colspan="5" rowspan="2" class="middle center"><b>Penerimaan Pengguna</b><br><span class="en">User Acceptance</span></td>
        <td rowspan="2" class="middle small">
            {!! $box($wo->accepted_at !== null) !!}Yes<br>
            {!! $box($wo->rework_count > 0 && $wo->accepted_at === null) !!}No
        </td>
        <td colspan="2" rowspan="2"><b>Lokasi/</b><span class="en">Function Location</span> :<br>{{ $wo->location?->name }}{{ $wo->location && $wo->location_note ? ' — ' : '' }}{{ $wo->location_note }}</td>
    </tr>
    <tr>
        <td colspan="3"><b>Nama Alat/</b><span class="en">Equip Name</span> : {{ $wo->equipment_name }}</td>
    </tr>

    <tr>
        <td colspan="3" class="center"><b>Permintaan Pekerjaan</b><br><span class="en">Request Work</span></td>
        <td colspan="8" class="center"><b>Pekerjaan Perbaikan Selesai</b><br><span class="en">Repair Work Done</span></td>
    </tr>
    <tr>
        <td colspan="3" rowspan="2"><div class="text-block">{{ $wo->request_description }}</div></td>
        <td colspan="8"><div class="text-block">{{ $wo->work_done }}</div></td>
    </tr>
    <tr>
        <td colspan="8" class="yellow center bold">Maintenance Clearance Checklist</td>
    </tr>

    <tr>
        <td colspan="3" class="center"><b>Prioritas/</b><span class="en">Priority</span></td>
        <td colspan="2" class="yellow center bold">No.</td>
        <td colspan="2" class="yellow center bold">Kondisi Area Kerja</td>
        <td colspan="3" class="yellow center bold">MTC (Nama/ Prf/ Tgl)</td>
        <td class="yellow center bold">User (Nama/ Prf/ Tgl)</td>
    </tr>
    @foreach ($wo->clearances as $i => $clearance)
        <tr>
            @if ($i === 0)
                <td colspan="3" rowspan="{{ $wo->clearances->count() }}" class="middle">
                    {!! $box($wo->priority->value === 'high') !!}Tinggi/<span class="en">High</span>&nbsp;&nbsp;
                    {!! $box($wo->priority->value === 'medium') !!}Menengah/<span class="en">Medium</span>&nbsp;&nbsp;
                    {!! $box($wo->priority->value === 'low') !!}Rendah/<span class="en">Low</span>
                </td>
            @endif
            <td colspan="2" class="yellow center">{{ $clearance->item_no }}.</td>
            <td colspan="2" class="yellow small">{{ $clearance->item_label }}</td>
            <td colspan="3" class="yellow small">{!! $clearanceText($clearance->mtc_result, $clearance->mtcConfirmedBy, $clearance->mtc_confirmed_at) !!}</td>
            <td class="yellow small">
                @if ($wo->auto_accepted && ! $clearance->user_result)
                    <i>Diterima otomatis</i>
                @else
                    {!! $clearanceText($clearance->user_result, $clearance->userConfirmedBy, $clearance->user_confirmed_at) !!}
                @endif
            </td>
        </tr>
    @endforeach

    <tr>
        <td colspan="2" rowspan="2" class="center middle"><b>Keterangan Material</b><br><span class="en">Description Material</span></td>
        <td rowspan="2" class="center middle"><b>Jumlah</b><br><span class="en">Quantity</span></td>
        <td colspan="3" rowspan="2" class="center middle"><b>Pekerja</b><br><span class="en">Labour</span></td>
        <td colspan="3" class="center"><b>Jam/</b><span class="en">Hour</span></td>
        <td colspan="2" rowspan="2" class="center middle"><b>Remarks</b></td>
    </tr>
    <tr>
        <td colspan="2" class="center small"><b>Mulai</b><br><span class="en">Start</span></td>
        <td class="center small"><b>Selesai</b><br><span class="en">Finish</span></td>
    </tr>
    @for ($r = 0; $r < $rowCount; $r++)
        @php($m = $materials->get($r))
        @php($l = $labours->get($r))
        <tr>
            <td colspan="2" class="small">{{ $m?->material_name }}&nbsp;</td>
            <td class="small center">{{ $m ? rtrim(rtrim(number_format($m->quantity, 2, ',', '.'), '0'), ',').' '.$m->unit : '' }}</td>
            <td colspan="3" class="small">{{ $l?->worker_name }}</td>
            <td colspan="2" class="small center">
                @if ($l){{ $fmtTime($l->started_at) }}<br><span class="tiny muted">{{ $l->started_at->timezone(config('app.timezone'))->format('d/m/y') }}</span>@endif
            </td>
            <td class="small center">
                @if ($l){{ $fmtTime($l->finished_at) }}<br><span class="tiny muted">{{ $l->finished_at->timezone(config('app.timezone'))->format('d/m/y') }}</span>@endif
            </td>
            @if ($r === 0)
                <td colspan="2" rowspan="{{ $rowCount }}" class="small">{{ $wo->remarks }}</td>
            @endif
        </tr>
    @endfor

    <tr>
        <td class="center"><b>Diminta Oleh,</b><br><span class="en">Requested by,</span></td>
        <td colspan="3" class="center"><b>Diterima Oleh</b><br><span class="en">Received by,</span></td>
        <td colspan="5" class="center"><b>Pekerjaan Diselesaikan Oleh</b><br><span class="en">Job Done by,</span></td>
        <td colspan="2" class="center"><b>Pekerjaan Diterima Oleh,</b><br><span class="en">Job Accepted by,</span></td>
    </tr>
    <tr>
        @foreach ([['requested', 1, 'User'], ['received', 3, 'MTC'], ['completed', 5, 'MTC In Charge'], ['accepted', 2, 'User In Charge']] as [$role, $span, $caption])
            <td colspan="{{ $span }}" class="sign">
                @if ($sig = $signatures->get($role))
                    <img class="qr" src="{{ $sig['qr'] }}"><div class="name">{{ $sig['name'] }}</div>
                @elseif ($role === 'accepted' && $wo->auto_accepted)
                    <div style="height:62px"></div><div class="name">Sistem (otomatis)</div>
                @else
                    <div style="height:62px"></div><div>&nbsp;</div>
                @endif
                <div class="small">{{ $caption }}</div>
            </td>
        @endforeach
    </tr>
    <tr>
        <td class="small">Waktu/<span class="en">Time</span> : {{ $fmtDateTime($wo->issued_at) }}</td>
        <td colspan="3" class="small">Waktu/<span class="en">Time</span> : {{ $fmtDateTime($wo->received_at) }}</td>
        <td colspan="5" class="small">
            Selesai/<span class="en">Finish</span><br>
            Tanggal/<span class="en">Date</span> : {{ $fmtDate($wo->completed_at) }}&nbsp;&nbsp;
            Waktu/<span class="en">Time</span> : {{ $fmtTime($wo->completed_at) }}
        </td>
        <td colspan="2" class="small">
            Total Rincian/<span class="en">Total Breakdown</span> :<br>
            {{ $wo->total_breakdown_hours !== null ? rtrim(rtrim(number_format($wo->total_breakdown_hours, 2, ',', '.'), '0'), ',') : '....' }} Jam/<span class="en">Hours</span>
        </td>
    </tr>
</table>

<table class="notes tiny" style="margin-top:5px">
    <tr><td><b>Cara Pengisian Form WO:</b></td></tr>
    <tr><td>No.WO: nomor WO · Date: tanggal terbit WO · Department/Section: isi sesuai Department/Section · Katagori/Category: check list sesuai bidang pekerjaan · No. Alat/Nama Alat: isi sesuai nomor & nama alat · Lokasi: isi sesuai lokasi pekerjaan.</td></tr>
    <tr><td>Permintaan Pekerjaan: isi sesuai permintaan · Pekerjaan Perbaikan Selesai: diisi team Maintenance setelah selesai · Prioritas: check list Tinggi/Menengah/Rendah · Penerimaan Pengguna: check list Yes/No setelah pekerjaan diselesaikan.</td></tr>
    <tr><td>Maintenance Clearance Checklist: diisi User dan Team Maintenance terhadap kondisi area kerja (Nama, paraf, tanggal) · Keterangan Material & Pekerja: diisi team Maintenance · Total Breakdown: diisi User bila terjadi breakdown akibat pekerjaan (jam).</td></tr>
    <tr><td class="muted">Dokumen ini disahkan secara elektronik melalui PM-App. Pindai QR pada kolom pengesahan untuk memverifikasi penanda tangan. Dicetak {{ $fmtDateTime($printedAt) }} · Status: {{ $wo->status->label() }}{{ $wo->rework_count ? ' · Dikerjakan ulang '.$wo->rework_count.'x' : '' }}</td></tr>
</table>

</body>
</html>
