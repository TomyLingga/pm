<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // Mirror of Portal INTES `unit_organisasi` (direktorat → sevp → bagian → sub_bagian → seksi).
        Schema::create('org_units', function (Blueprint $table) {
            $table->id();
            $table->uuid('portal_unit_id')->unique();
            $table->string('code', 30)->index();
            $table->string('name', 150);
            $table->string('type', 20);
            $table->foreignId('parent_id')->nullable()->constrained('org_units')->nullOnDelete();
            $table->boolean('is_active')->default(true);
            $table->timestamp('synced_at')->nullable();
            $table->timestamps();
        });

        // Local copy of Portal employee profiles. No password column: web logs in via SSO,
        // mobile credentials are checked by Portal.
        Schema::create('users', function (Blueprint $table) {
            $table->id();
            $table->uuid('portal_user_id')->nullable()->unique();
            $table->uuid('portal_employee_id')->nullable()->unique();
            $table->string('nrk', 50)->nullable()->unique();
            $table->string('name', 150);
            $table->string('email')->nullable()->index();
            $table->string('phone', 30)->nullable();
            $table->string('employment_status', 100)->nullable();
            $table->string('position', 150)->nullable();
            $table->string('grade_code', 20)->nullable();
            $table->smallInteger('grade_level')->nullable();
            $table->foreignId('org_unit_id')->nullable()->constrained('org_units')->nullOnDelete();
            $table->foreignId('preferred_superior_id')->nullable()->constrained('users')->nullOnDelete();
            $table->string('photo_url', 500)->nullable();
            $table->boolean('is_active')->default(true);
            $table->rememberToken();
            $table->timestamp('last_login_at')->nullable();
            $table->timestamp('profile_synced_at')->nullable();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('users');
        Schema::dropIfExists('org_units');
    }
};
