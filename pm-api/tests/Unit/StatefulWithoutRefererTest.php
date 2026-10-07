<?php

namespace Tests\Unit;

use App\Http\Middleware\StatefulWithoutReferer;
use Illuminate\Http\Request;
use Tests\TestCase;

class StatefulWithoutRefererTest extends TestCase
{
    private function pass(Request $request): Request
    {
        $seen = null;
        (new StatefulWithoutReferer())->handle($request, function (Request $r) use (&$seen) {
            $seen = $r;

            return response('ok');
        });

        return $seen;
    }

    public function test_get_with_session_cookie_but_no_referer_gets_the_web_url_as_referer(): void
    {
        config(['pm.web_url' => 'http://localhost:3000', 'session.cookie' => 'pm_app_session']);
        $request = Request::create('/api/v1/service-requests/15/pdf', 'GET', [], ['pm_app_session' => 'abc']);

        $this->assertSame('http://localhost:3000', $this->pass($request)->headers->get('referer'));
    }

    public function test_other_requests_are_left_alone(): void
    {
        config(['pm.web_url' => 'http://localhost:3000', 'session.cookie' => 'pm_app_session']);

        $noCookie = Request::create('/api/v1/service-requests/15/pdf', 'GET');
        $this->assertNull($this->pass($noCookie)->headers->get('referer'));

        $post = Request::create('/api/v1/work-orders', 'POST', [], ['pm_app_session' => 'abc']);
        $this->assertNull($this->pass($post)->headers->get('referer'));

        $withReferer = Request::create('/api/v1/me', 'GET', [], ['pm_app_session' => 'abc'], [], ['HTTP_REFERER' => 'https://evil.test/']);
        $this->assertSame('https://evil.test/', $this->pass($withReferer)->headers->get('referer'));
    }
}
