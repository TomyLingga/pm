<?php

namespace App\Providers;

use Illuminate\Foundation\Support\Providers\AuthServiceProvider as ServiceProvider;
use Illuminate\Support\Facades\Gate;

class AuthServiceProvider extends ServiceProvider
{
    /**
     * The policy mappings for the application.
     *
     * @var array<class-string, class-string>
     */
    protected $policies = [
        \App\Models\WorkOrder::class => \App\Policies\WorkOrderPolicy::class,
        \App\Models\ServiceRequest::class => \App\Policies\ServiceRequestPolicy::class,
        \App\Models\ChecklistTemplate::class => \App\Policies\PmPolicy::class,
        \App\Models\PmSchedule::class => \App\Policies\PmPolicy::class,
        \App\Models\PmTask::class => \App\Policies\PmPolicy::class,
        \App\Models\Equipment::class => \App\Policies\PmPolicy::class,
    ];

    /**
     * Register any authentication / authorization services.
     *
     * @return void
     */
    public function boot()
    {
        $this->registerPolicies();

        //
    }
}
