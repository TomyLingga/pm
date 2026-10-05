<?php

namespace Tests\Concerns;

use Illuminate\Support\Facades\Http;

/** Builds Portal INTES responses (shape of portal-app-be `ok()` envelope). */
trait FakesPortal
{
    protected string $portalUserId = 'aaaaaaaa-0000-0000-0000-000000000001';
    protected string $portalEmployeeId = 'bbbbbbbb-0000-0000-0000-000000000001';

    /** Payload of POST /api/sso/verify. */
    protected function portalProfile(array $employeeOverrides = [], array $userOverrides = []): array
    {
        return array_replace([
            'id' => $this->portalUserId,
            'email' => 'adib@inl.co.id',
            'role' => 'user',
            'isActive' => true,
            'employeeId' => $this->portalEmployeeId,
            'employee' => array_replace([
                'id' => $this->portalEmployeeId,
                'nrk' => '119090170',
                'nama' => 'Muhammad Adib Nugraha',
                'namaLengkap' => 'Muhammad Adib Nugraha',
                'jabatan' => 'Asisten Pengadaan',
                'fotoProfil' => 'https://portal.test/uploads/adib.jpg',
                'isActive' => true,
                'nomorHp' => '085322762975',
                'statusKaryawan' => ['id' => 'st-1', 'kode' => 'TETAP', 'label' => 'Karyawan Tetap'],
                'atasan' => ['id' => 'cccccccc-0000-0000-0000-000000000001', 'nrk' => '1001', 'nama' => 'Indra Sakti Lubis', 'jabatan' => 'Kabag', 'nomorHp' => '0857'],
                'grade' => ['id' => 'g-3', 'kode' => 'BOM-3', 'label' => 'Assisten/Supervisor', 'level' => 8],
                'unit' => [
                    'id' => '0b000000-0000-0000-0000-00000000000b', 'kode' => 'PGD', 'nama' => 'Pengadaan', 'tipe' => 'sub_bagian', 'parentId' => '0a000000-0000-0000-0000-00000000000a',
                    'path' => 'Keuangan & Pengadaan / Pengadaan',
                    'hierarchy' => [
                        ['id' => '0a000000-0000-0000-0000-00000000000a', 'kode' => 'KEU', 'nama' => 'Keuangan & Pengadaan', 'tipe' => 'bagian', 'parentId' => null],
                        ['id' => '0b000000-0000-0000-0000-00000000000b', 'kode' => 'PGD', 'nama' => 'Pengadaan', 'tipe' => 'sub_bagian', 'parentId' => '0a000000-0000-0000-0000-00000000000a'],
                    ],
                ],
            ], $employeeOverrides),
        ], $userOverrides);
    }

    protected function portalOk(array $data, int $status = 200)
    {
        return Http::response(['success' => true, 'data' => $data], $status);
    }

    protected function portalError(string $message, int $status = 400)
    {
        return Http::response(['success' => false, 'error' => $message], $status);
    }
}
