<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // A Portal section (seksi) that executes work orders / requests, e.g. "IT".
        Schema::create('executor_units', function (Blueprint $table) {
            $table->id();
            $table->foreignId('org_unit_id')->unique()->constrained('org_units');
            $table->string('code', 30)->unique(); // used in WO/REQ numbers
            $table->string('display_name', 150);
            $table->boolean('accepts_work_orders')->default(true);
            $table->boolean('accepts_requests')->default(true);
            $table->boolean('has_pm')->default(false);
            $table->text('request_rules')->nullable();
            $table->string('contact_footer')->nullable();
            $table->boolean('is_active')->default(true);
            $table->timestamps();
            $table->softDeletes();
        });

        // Manual staff overrides on top of the org-unit subtree membership.
        Schema::create('executor_unit_members', function (Blueprint $table) {
            $table->id();
            $table->foreignId('executor_unit_id')->constrained()->cascadeOnDelete();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->string('membership', 10)->default('include'); // include | exclude
            $table->string('note')->nullable();
            $table->timestamps();
            $table->unique(['executor_unit_id', 'user_id']);
        });

        Schema::create('service_categories', function (Blueprint $table) {
            $table->id();
            $table->foreignId('executor_unit_id')->constrained()->cascadeOnDelete();
            $table->string('name', 100);
            $table->boolean('for_work_order')->default(true);
            $table->boolean('for_request')->default(true);
            $table->boolean('requires_note')->default(false);
            $table->unsignedSmallInteger('sort_order')->default(0);
            $table->boolean('is_active')->default(true);
            $table->timestamps();
            $table->softDeletes();
        });

        Schema::create('locations', function (Blueprint $table) {
            $table->id();
            $table->foreignId('parent_id')->nullable()->constrained('locations')->nullOnDelete();
            $table->string('code', 50)->unique();
            $table->string('name', 150);
            $table->boolean('is_active')->default(true);
            $table->timestamps();
            $table->softDeletes();
        });

        Schema::create('equipment', function (Blueprint $table) {
            $table->id();
            $table->string('code', 50)->unique();
            $table->string('name', 150);
            $table->foreignId('location_id')->nullable()->constrained()->nullOnDelete();
            $table->foreignId('executor_unit_id')->nullable()->constrained()->nullOnDelete();
            $table->string('brand', 100)->nullable();
            $table->string('model', 100)->nullable();
            $table->string('serial_number', 100)->nullable();
            $table->string('status', 20)->default('active');
            $table->timestamps();
            $table->softDeletes();
        });

        Schema::create('materials', function (Blueprint $table) {
            $table->id();
            $table->string('code', 50)->unique();
            $table->string('name', 150);
            $table->string('unit', 20);
            $table->boolean('is_active')->default(true);
            $table->timestamps();
            $table->softDeletes();
        });

        Schema::create('holidays', function (Blueprint $table) {
            $table->id();
            $table->date('date')->unique();
            $table->string('name', 150);
            $table->timestamps();
        });

        Schema::create('number_sequences', function (Blueprint $table) {
            $table->id();
            $table->string('doc_type', 30);
            $table->string('scope_code', 30);
            $table->unsignedSmallInteger('year');
            $table->unsignedInteger('last_number')->default(0);
            $table->timestamps();
            $table->unique(['doc_type', 'scope_code', 'year']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('number_sequences');
        Schema::dropIfExists('holidays');
        Schema::dropIfExists('materials');
        Schema::dropIfExists('equipment');
        Schema::dropIfExists('locations');
        Schema::dropIfExists('service_categories');
        Schema::dropIfExists('executor_unit_members');
        Schema::dropIfExists('executor_units');
    }
};
