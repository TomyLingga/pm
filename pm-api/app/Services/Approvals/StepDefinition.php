<?php

namespace App\Services\Approvals;

use App\Models\ApprovalStep;

/** Blueprint of one step when a document starts (or restarts) its approval chain. */
final class StepDefinition
{
    public function __construct(
        public readonly string $key,
        public readonly string $label,
        public readonly string $kind = ApprovalStep::KIND_APPROVAL,
        public readonly string $assigneeType = ApprovalStep::ASSIGNEE_USER,
        public readonly ?int $assigneeUserId = null,
        public readonly ?int $executorUnitId = null,
        public readonly bool $skip = false,
        public readonly ?string $skipNote = null,
    ) {
    }
}
