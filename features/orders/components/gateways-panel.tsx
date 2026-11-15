'use client';

import { CircleAlert, CircleCheck, Copy, PlugZap, ServerCog, ShieldCheck, Webhook } from 'lucide-react';
import { useState, type ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { ErrorState, Skeleton } from '@/components/ui/states';
import { normalizeApiError } from '@/lib/api-error';
import { cn } from '@/lib/cn';
import { env } from '@/lib/env';
import { formatDate } from '@/lib/format';
import { useToast } from '@/providers/toast-provider';
import type { GatewayProvider } from '@/services/gateways.service';
import type { GatewayTestResult, PayPalGatewayInfo, RazorpayGatewayInfo } from '@/types/commerce';
import { useGateways, useGatewayStatus, useTestGateway } from '../hooks';

const SOURCE_LABEL = { environment: 'Backend environment', database: 'Stored in database (legacy)', none: 'Not configured' } as const;

/** Variable names from the backend `.env`; values are never sent to the console. */
function envRows(provider: GatewayProvider, gateway: RazorpayGatewayInfo | PayPalGatewayInfo, webhookReady: boolean) {
  const fromEnv = gateway.source === 'environment';
  const modeValue = gateway.mode === 'live' ? 'live' : provider === 'razorpay' ? 'test' : 'sandbox';
  return provider === 'razorpay'
    ? [
        { name: 'RAZORPAY_ENABLED', state: gateway.envEnabled ? 'true' : 'false', ok: gateway.envEnabled },
        { name: 'RAZORPAY_MODE', state: modeValue, ok: true },
        { name: 'RAZORPAY_KEY_ID', state: fromEnv ? 'Set' : 'Not set', ok: fromEnv },
        { name: 'RAZORPAY_KEY_SECRET', state: fromEnv && gateway.secretKeyConfigured ? 'Set' : 'Not set', ok: fromEnv && gateway.secretKeyConfigured },
        { name: 'RAZORPAY_WEBHOOK_SECRET', state: webhookReady ? 'Set' : 'Not set', ok: webhookReady },
      ]
    : [
        { name: 'PAYPAL_ENABLED', state: gateway.envEnabled ? 'true' : 'false', ok: gateway.envEnabled },
        { name: 'PAYPAL_MODE', state: modeValue, ok: true },
        { name: 'PAYPAL_CLIENT_ID', state: fromEnv ? 'Set' : 'Not set', ok: fromEnv },
        { name: 'PAYPAL_CLIENT_SECRET', state: fromEnv && gateway.secretKeyConfigured ? 'Set' : 'Not set', ok: fromEnv && gateway.secretKeyConfigured },
        { name: 'PAYPAL_WEBHOOK_ID', state: webhookReady ? 'Set' : 'Not set', ok: webhookReady },
        { name: 'PAYPAL_CURRENCY', state: gateway.currency, ok: true },
      ];
}

function Fact({ label, ok, children }: { label: string; ok?: boolean; children: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3 py-2 text-sm">
      <dt className="text-ink-muted">{label}</dt>
      <dd className={cn('flex min-w-0 items-center gap-1.5 text-right', ok === undefined ? 'text-ink' : ok ? 'text-success' : 'text-ink-subtle')}>
        {ok === undefined ? null : ok ? <CircleCheck className="size-3.5 shrink-0" aria-hidden /> : <CircleAlert className="size-3.5 shrink-0" aria-hidden />}
        <span className="truncate">{children}</span>
      </dd>
    </div>
  );
}

function GatewayCard({ provider, gateway, isDefault }: { provider: GatewayProvider; gateway: RazorpayGatewayInfo | PayPalGatewayInfo; isDefault: boolean }) {
  const toast = useToast();
  const status = useGatewayStatus(provider);
  const test = useTestGateway(provider);
  const [result, setResult] = useState<GatewayTestResult | null>(null);
  const isRz = provider === 'razorpay';
  const publicId = isRz ? (gateway as RazorpayGatewayInfo).keyId : (gateway as PayPalGatewayInfo).clientId;
  const webhookReady = isRz ? (gateway as RazorpayGatewayInfo).webhookSecretConfigured : (gateway as PayPalGatewayInfo).webhookIdConfigured;
  const webhookUrl = `${env.apiBaseUrl}/webhooks/${provider}`;
  const ready = status.data?.ready;

  function runTest() {
    setResult(null);
    test.mutate(undefined, {
      onSuccess: setResult,
      onError: (e) => setResult({ ok: false, message: normalizeApiError(e).message }),
    });
  }

  return (
    <Card className="flex min-w-0 flex-col">
      <div className="flex items-start justify-between gap-3 border-b border-line p-4 sm:p-5">
        <div className="flex min-w-0 items-center gap-3">
          <span className={cn('flex size-11 shrink-0 items-center justify-center rounded-xl text-sm font-bold text-white', isRz ? 'bg-[#0c2451] dark:bg-[#1d3b7a]' : 'bg-[#003087] dark:bg-[#1a4fb0]')} aria-hidden>
            {isRz ? 'Rz' : 'PP'}
          </span>
          <div className="min-w-0">
            <h3 className="flex items-center gap-2 text-base font-semibold text-ink">
              {isRz ? 'Razorpay' : 'PayPal'}
              {isDefault ? <span className="rounded-md bg-primary/10 px-1.5 py-0.5 text-[11px] font-medium text-primary">Default</span> : null}
            </h3>
            <p className="text-xs text-ink-muted">{isRz ? 'India checkout · INR' : `International checkout · ${gateway.currency}`}</p>
          </div>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1">
          <span className={cn('inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px] font-medium ring-1 ring-inset', gateway.isEnabled ? 'bg-success/10 text-success ring-success/25' : 'bg-surface-2 text-ink-muted ring-line')}>
            {gateway.isEnabled ? 'Enabled' : 'Disabled'}
          </span>
          <span className={cn('rounded-md px-1.5 py-0.5 text-[11px] font-medium', gateway.mode === 'live' ? 'bg-warning/10 text-warning' : 'bg-info/10 text-info')}>
            {gateway.mode === 'live' ? 'Live' : isRz ? 'Test mode' : 'Sandbox'}
          </span>
        </div>
      </div>

      <div className="flex-1 space-y-4 p-4 sm:p-5">
        <div className={cn('flex items-center gap-2 rounded-lg px-3 py-2 text-sm', status.isPending ? 'bg-surface-2' : ready ? 'bg-success/[0.07] text-success' : 'bg-warning/[0.08] text-warning')}>
          {status.isPending ? (
            <Skeleton className="h-4 w-40" />
          ) : status.isError ? (
            <span className="text-danger">Status unavailable: {normalizeApiError(status.error).message}</span>
          ) : (
            <>
              {ready ? <ShieldCheck className="size-4" aria-hidden /> : <CircleAlert className="size-4" aria-hidden />}
              <span className="font-medium">{ready ? 'Ready to accept payments' : 'Not ready: credentials missing'}</span>
              {status.data && !status.data.webhookConfigured ? <span className="ml-auto text-xs text-warning">Webhook not set</span> : null}
            </>
          )}
        </div>

        <dl className="divide-y divide-line">
          <Fact label={isRz ? 'Key id' : 'Client id'}>{publicId ? <span className="font-mono text-xs">{publicId}</span> : 'Not set'}</Fact>
          <Fact label={isRz ? 'Key secret' : 'Client secret'} ok={gateway.secretKeyConfigured}>
            {gateway.secretKeyConfigured ? 'Configured' : 'Not set'}
          </Fact>
          <Fact label={isRz ? 'Webhook secret' : 'Webhook id'} ok={webhookReady}>
            {webhookReady ? 'Configured' : 'Not set'}
          </Fact>
          <Fact label="Credentials from">{SOURCE_LABEL[gateway.source]}</Fact>
          <Fact label="Billing countries">{gateway.allowedCountries.length ? gateway.allowedCountries.join(', ') : 'Any'}</Fact>
          {gateway.updatedAt ? <Fact label="Last updated">{formatDate(gateway.updatedAt)}</Fact> : null}
        </dl>

        <div className="rounded-lg border border-line">
          <p className="flex items-center gap-1.5 border-b border-line px-3 py-2 text-xs font-medium text-ink">
            <ServerCog className="size-3.5 text-ink-subtle" aria-hidden />
            Backend environment
          </p>
          <ul className="divide-y divide-line">
            {envRows(provider, gateway, webhookReady).map((row) => (
              <li key={row.name} className="flex items-center justify-between gap-3 px-3 py-1.5">
                <code className="min-w-0 truncate font-mono text-[11px] text-ink-muted">{row.name}</code>
                <span className={cn('flex shrink-0 items-center gap-1 text-xs', row.ok ? 'text-ink' : 'text-ink-subtle')}>
                  {row.ok ? <CircleCheck className="size-3 text-success" aria-hidden /> : <CircleAlert className="size-3 text-warning" aria-hidden />}
                  {row.state}
                </span>
              </li>
            ))}
          </ul>
          <p className="border-t border-line px-3 py-2 text-[11px] text-ink-subtle">
            Keys, mode (test or live) and enablement are set in the backend <code className="font-mono">.env</code> and apply after the API restarts. They cannot be edited here.
          </p>
        </div>

        <div className="rounded-lg border border-line bg-surface-2/50 p-3">
          <p className="flex items-center gap-1.5 text-xs font-medium text-ink">
            <Webhook className="size-3.5 text-ink-subtle" aria-hidden />
            Webhook endpoint
          </p>
          <div className="mt-1.5 flex items-center gap-2">
            <code className="min-w-0 flex-1 truncate rounded bg-surface px-2 py-1 font-mono text-[11px] text-ink-muted">{webhookUrl}</code>
            <button
              type="button"
              onClick={() => navigator.clipboard.writeText(webhookUrl).then(() => toast.success('Webhook URL copied'))}
              className="rounded-md p-1.5 text-ink-subtle hover:bg-surface hover:text-ink"
              aria-label="Copy webhook URL"
            >
              <Copy className="size-3.5" />
            </button>
          </div>
          <p className="mt-1.5 text-[11px] text-ink-subtle">
            {isRz ? 'Add in Razorpay Dashboard → Webhooks. Requests are verified with X-Razorpay-Signature.' : 'Add in the PayPal developer dashboard. Events are verified with PayPal using the webhook id.'}
          </p>
        </div>

        {result ? (
          <div role="status" className={cn('rounded-lg border px-3 py-2 text-sm', result.ok ? 'border-success/30 bg-success/[0.06]' : 'border-danger/25 bg-danger/[0.05]')}>
            <p className={cn('font-medium', result.ok ? 'text-success' : 'text-danger')}>{result.ok ? 'Connection test passed' : 'Connection test failed'}</p>
            <p className="text-xs text-ink-muted">
              {result.message}
              {result.code ? ` (${result.code})` : ''}
              {result.ok && result.mode ? ` · ${result.mode} mode` : ''}
              {result.keyIdMasked || result.clientIdMasked ? ` · ${result.keyIdMasked ?? result.clientIdMasked}` : ''}
            </p>
          </div>
        ) : null}
      </div>

      <div className="flex flex-wrap justify-end gap-2 border-t border-line p-4">
        <Button size="sm" variant="secondary" onClick={runTest} loading={test.isPending}>
          <PlugZap className="size-3.5" aria-hidden />
          Test connection
        </Button>
      </div>
    </Card>
  );
}

export function GatewaysPanel() {
  const gateways = useGateways();
  if (gateways.isError) return <ErrorState error={gateways.error} onRetry={() => gateways.refetch()} />;
  if (gateways.isPending)
    return (
      <div className="grid gap-4 lg:grid-cols-2">
        {[0, 1].map((i) => (
          <Card key={i} className="space-y-3 p-5">
            <Skeleton className="h-10 w-40" />
            <Skeleton className="h-8 w-full" />
            <Skeleton className="h-40 w-full" />
          </Card>
        ))}
      </div>
    );
  const rz = gateways.data.gateways.find((g): g is RazorpayGatewayInfo => g.provider === 'razorpay');
  const pp = gateways.data.gateways.find((g): g is PayPalGatewayInfo => g.provider === 'paypal');
  return (
    <div className="space-y-3">
      <p className="text-xs text-ink-muted">Learners see Razorpay for Indian billing addresses and PayPal for international ones. Payment confirmation always comes from verified gateway webhooks.</p>
      <div className="grid gap-4 lg:grid-cols-2">
        {rz ? <GatewayCard provider="razorpay" gateway={rz} isDefault={gateways.data.defaultGateway === 'razorpay'} /> : null}
        {pp ? <GatewayCard provider="paypal" gateway={pp} isDefault={gateways.data.defaultGateway === 'paypal'} /> : null}
      </div>
    </div>
  );
}
