@php
    /** @var \App\Models\ServiceRequest $sr */
    $tz = config('app.timezone');
    $longDate = fn ($d) => $d ? $d->timezone($tz)->translatedFormat('j F Y') : '';
    $identity = $sr->submitted_at ? [
        'name' => $sr->requester_name, 'status' => $sr->requester_employment_status, 'nrk' => $sr->requester_nrk,
        'position' => $sr->requester_position, 'superior' => $sr->superior_name, 'bagian' => $sr->requester_bagian_name,
        'sub_bagian' => $sr->requester_sub_bagian_name, 'email' => $sr->requester_email,
    ] : [
        'name' => $sr->requester->name, 'status' => $sr->requester->employment_status, 'nrk' => $sr->requester->nrk,
        'position' => $sr->requester->position, 'superior' => $sr->superior?->name,
        'bagian' => $sr->requester->orgUnit?->ancestorOfType('bagian')?->name,
        'sub_bagian' => $sr->requester->orgUnit?->ancestorOfType('sub_bagian')?->name, 'email' => $sr->requester->email,
    ];
    $ruleLines = collect(preg_split('/\r?\n/', (string) $rules))->map(fn ($l) => trim($l))->filter()->values();
@endphp
<!DOCTYPE html>
<html lang="id">
<head>
<meta charset="utf-8">
<title>{{ $sr->displayNumber() }}</title>
<style>
    @page { margin: 24px 30px 20px 30px; }
    body { font-family: 'Times New Roman', Times, serif; font-size: 8.6pt; color: #000; margin: 0; }
    table { width: 100%; border-collapse: collapse; table-layout: fixed; }
    td { vertical-align: top; padding: 2px 4px; word-wrap: break-word; }
    tr.sizer td { border: none !important; padding: 0; height: 0; line-height: 0; font-size: 0; }
    .sans { font-family: Helvetica, Arial, sans-serif; }
    .header td { border: 0.8px solid #000; }
    .center { text-align: center; }
    .middle { vertical-align: middle; }
    .bold { font-weight: bold; }
    .company { font-size: 11pt; font-weight: bold; text-decoration: underline; }
    .frame { border: 3px double #000; padding: 6px 8px; margin-top: 8px; }
    .bar { background: #58D68D; border: 1px solid #1E8449; font-weight: bold; padding: 5px 8px; }
    .bar.center { text-align: center; }
    .gap td { height: 4px; padding: 0; }
    .sign td { padding: 1.5px 3px; }
    .sign .caption { font-weight: bold; width: 26%; }
    .sign .sep td { border-bottom: 0.8px solid #000; }
    .qr { width: 44px; height: 44px; }
    .muted { color: #555; }
    .rules { font-style: italic; }
    .rules p { margin: 0 0 6px 0; }
    .small { font-size: 7.6pt; }
    .stamp { font-style: italic; color: #7a7a7a; }
</style>
</head>
<body>

<table class="header sans">
    <tr class="sizer"><td style="width:12%"></td><td style="width:53%"></td><td style="width:17.5%"></td><td style="width:17.5%"></td></tr>
    <tr>
        <td rowspan="2" class="center middle">@if ($logo)<img src="{{ $logo }}" style="width:88px">@endif</td>
        <td class="center" style="border-bottom:none">
            <div class="company">{{ $doc['company'] }}</div>
            <div class="bold small">{{ $doc['subtitle'] }}</div>
            <div class="bold small">{{ $doc['address'] }}</div>
        </td>
        <td class="center" style="font-family: 'Times New Roman', serif"><div class="bold">No. Dokumen</div><div style="margin-top:6px">{{ $doc['number'] }}</div></td>
        <td class="center" style="font-family: 'Times New Roman', serif"><div class="bold">Tgl. Berlaku</div><div style="margin-top:6px">{{ $doc['effective_date'] }}</div></td>
    </tr>
    <tr>
        <td class="center" style="border-top:none">
            <div class="bold" style="font-size:11pt">{{ $doc['title'] }}</div>
            <div>{{ $sr->displayNumber() }}</div>
        </td>
        <td class="center" style="font-family: 'Times New Roman', serif"><div class="bold">No. Revisi</div><div style="margin-top:6px">{{ $doc['revision'] }}</div></td>
        <td class="center" style="font-family: 'Times New Roman', serif"><div class="bold">Halaman</div><div style="margin-top:6px">1 dari 1</div></td>
    </tr>
</table>

<div class="frame">
<table>
    <tr class="sizer"><td style="width:41.5%"></td><td style="width:0.8%"></td><td style="width:57.7%"></td></tr>
    <tr><td colspan="3" style="padding:2px 0 3px 0"><b>Office:</b> {{ $sr->office?->name }}</td></tr>
    <tr>
        <td class="bar">KEPERLUAN</td><td></td>
        <td class="bar center">PENGESAHAN</td>
    </tr>
    <tr>
        <td class="middle" style="padding:8px">{!! nl2br(e($sr->purpose)) !!}</td><td></td>
        <td style="padding:4px 4px 6px 4px">
            <table class="sign">
                <tr class="sizer"><td style="width:27%"></td><td style="width:62%"></td><td style="width:11%"></td></tr>
                @foreach ($rows as $i => $row)
                    @php($step = $row['step'])
                    <tr>
                        <td class="caption">{{ $row['caption'] }}</td>
                        <td>:
                            @if ($row['signed'])
                                {{ $row['verb'] }} {{ $step->actor_name }} pada {{ $longDate($step->acted_at) }}
                            @elseif ($step && $step->status->value === 'skipped')
                                <span class="stamp">Dilewati — {{ $step->notes }}</span>
                            @elseif ($step && in_array($step->status->value, ['rejected', 'revision_requested'], true))
                                <span class="stamp">{{ $step->status->label() }} oleh {{ $step->actor_name }} pada {{ $longDate($step->acted_at) }}</span>
                            @elseif ($step && $step->status->value === 'pending')
                                <span class="stamp">Menunggu — {{ $step->assigneeLabel() }}</span>
                            @else
                                <span class="stamp">-</span>
                            @endif
                        </td>
                        <td rowspan="2" class="center middle">@if ($row['qr'])<img class="qr" src="{{ $row['qr'] }}">@endif</td>
                    </tr>
                    <tr @if ($i === 1) class="sep" @endif>
                        <td class="caption">NO. HP</td>
                        <td>: {{ $row['signed'] ? $step->actor_phone : '' }}</td>
                    </tr>
                @endforeach
            </table>
        </td>
    </tr>
    <tr>
        <td class="bar">JENIS PERMINTAAN</td><td></td>
        <td class="bar">PETUNJUK DAN ATURAN</td>
    </tr>
    <tr>
        <td class="middle" style="padding:8px">{{ mb_strtoupper((string) $sr->serviceCategory?->name) }}</td><td></td>
        <td class="rules" style="padding:8px 6px 4px 6px">
            @forelse ($ruleLines as $line)<p>{{ $line }}</p>@empty<p class="muted">-</p>@endforelse
        </td>
    </tr>
    <tr>
        <td class="bar">PRIORITAS</td><td></td>
        <td class="bar">KETERANGAN</td>
    </tr>
    <tr>
        <td style="padding:8px">{{ $sr->priority->requestLabel() }}</td><td></td>
        <td style="padding:8px" class="rules">{{ $sr->executor_notes }}</td>
    </tr>
    <tr><td class="bar">IDENTITAS KARYAWAN</td><td></td><td></td></tr>
    <tr>
        <td style="padding:6px 8px">
            <table>
                <tr class="sizer"><td style="width:40%"></td><td style="width:60%"></td></tr>
                <tr><td>NAMA LENGKAP</td><td>: {{ $identity['name'] }}</td></tr>
                <tr><td>STATUS KARYAWAN</td><td>: {{ $identity['status'] }}</td></tr>
                <tr><td>NRK</td><td>: {{ $identity['nrk'] }}</td></tr>
                <tr><td>JABATAN</td><td>: {{ $identity['position'] }}</td></tr>
            </table>
        </td><td></td>
        <td style="padding:6px 8px">
            <table>
                <tr class="sizer"><td style="width:18%"></td><td style="width:82%"></td></tr>
                <tr><td>ATASAN</td><td>: {{ $identity['superior'] }}</td></tr>
                <tr><td>BAGIAN</td><td>: {{ $identity['bagian'] }}</td></tr>
                <tr><td>SUB BAGIAN</td><td>: {{ $identity['sub_bagian'] }}</td></tr>
                <tr><td>EMAIL INL</td><td>: {{ $identity['email'] }}</td></tr>
            </table>
        </td>
    </tr>
</table>
</div>

<table style="margin-top:6px" class="small">
    <tr>
        <td style="width:60%"><b>{{ $footer ?: 'Untuk informasi, silakan menghubungi '.$sr->executorUnit->display_name }}</b></td>
        <td style="width:40%; text-align:right" class="rules">({{ $doc['version_note'] }})</td>
    </tr>
    <tr>
        <td colspan="2" class="muted" style="font-size:6.8pt">
            Dokumen disahkan secara elektronik melalui PM-App; pindai QR pada blok PENGESAHAN untuk verifikasi.
            Status: {{ $sr->status->label() }}{{ $sr->revision_no ? ' · Revisi ke-'.$sr->revision_no : '' }} · Dicetak {{ $printedAt->timezone($tz)->translatedFormat('j F Y H:i') }}
        </td>
    </tr>
</table>

</body>
</html>
