import { useState } from "react";
import { useAccountInfo } from "@orderly.network/hooks";

type RiskCopilotProps = {
  symbol: string;
  markPrice?: number;
  estimatedFundingRate?: number;
};

const numberFormatter = new Intl.NumberFormat("en-US", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 4,
});

function formatAmount(value: number, quote: string) {
  return `${numberFormatter.format(value)} ${quote}`;
}

export default function RiskCopilot({
  symbol,
  markPrice,
  estimatedFundingRate,
}: RiskCopilotProps) {
  const [notionalInput, setNotionalInput] = useState("");
  const [stopInput, setStopInput] = useState("");
  const [rewardRiskInput, setRewardRiskInput] = useState("2");
  const [side, setSide] = useState<"long" | "short">("long");
  const { data: accountInfo, error: accountInfoError } = useAccountInfo();

  const quote = symbol.split("_").at(-1) ?? "USDC";
  const notional = Number(notionalInput);
  const stopPercent = Number(stopInput);
  const rewardRisk = Number(rewardRiskInput);
  const hasValidScenario =
    Number.isFinite(notional) &&
    notional > 0 &&
    Number.isFinite(stopPercent) &&
    stopPercent > 0 &&
    stopPercent < 100 &&
    Number.isFinite(rewardRisk) &&
    rewardRisk > 0 &&
    Number.isFinite(markPrice) &&
    Number(markPrice) > 0;

  const takerFeeRate = accountInfo?.futures_taker_fee_rate;
  const hasTakerFeeRate =
    typeof takerFeeRate === "number" &&
    Number.isFinite(takerFeeRate) &&
    takerFeeRate >= 0;
  const stopFraction = stopPercent / 100;
  const grossStopLoss = hasValidScenario ? notional * stopFraction : undefined;
  const targetProfit = hasValidScenario
    ? notional * stopFraction * rewardRisk
    : undefined;
  const stopPrice = hasValidScenario
    ? Number(markPrice) * (1 + (side === "long" ? -1 : 1) * stopFraction)
    : undefined;
  const targetPrice = hasValidScenario
    ? Number(markPrice) *
      (1 + (side === "long" ? 1 : -1) * stopFraction * rewardRisk)
    : undefined;
  const estimatedRoundTripFees =
    hasValidScenario && hasTakerFeeRate
      ? takerFeeRate *
        (notional + notional * (1 + (side === "long" ? -1 : 1) * stopFraction))
      : undefined;
  const estimatedLossIncludingFees =
    grossStopLoss !== undefined && estimatedRoundTripFees !== undefined
      ? grossStopLoss + estimatedRoundTripFees
      : undefined;
  const fundingRateIsAvailable =
    typeof estimatedFundingRate === "number" &&
    Number.isFinite(estimatedFundingRate);
  const estimatedNextFunding =
    hasValidScenario && fundingRateIsAvailable
      ? notional * estimatedFundingRate * (side === "long" ? 1 : -1)
      : undefined;

  return (
    <details className="oui-mb-2 oui-rounded-xl oui-border oui-border-line-12 oui-bg-base-8">
      <summary className="oui-flex oui-cursor-pointer oui-list-none oui-items-center oui-justify-between oui-gap-3 oui-px-4 oui-py-3 [&::-webkit-details-marker]:oui-hidden">
        <span>
          <span className="oui-block oui-text-sm oui-font-semibold oui-text-base-contrast-80">
            Frost Risk Copilot
          </span>
          <span className="oui-block oui-text-xs oui-text-base-contrast-54">
            Pre-trade scenario · {symbol.replaceAll("_", " / ")}
            {typeof markPrice === "number" && markPrice > 0
              ? ` · Mark ${numberFormatter.format(markPrice)} ${quote}`
              : " · Waiting for mark price"}
          </span>
        </span>
        <span className="oui-shrink-0 oui-text-xs oui-font-medium oui-text-primary">
          Review risk
        </span>
      </summary>

      <div className="oui-border-t oui-border-line-12 oui-p-4">
        <div className="oui-mb-4 oui-flex oui-flex-wrap oui-items-center oui-justify-between oui-gap-3">
          <p className="oui-max-w-2xl oui-text-xs oui-leading-relaxed oui-text-base-contrast-54">
            Planning estimate only. It does not read or change your order and
            never submits trades.
          </p>
          <div
            aria-label="Position direction"
            className="oui-flex oui-rounded-lg oui-border oui-border-line-12 oui-bg-base-7 oui-p-1"
          >
            {(["long", "short"] as const).map((value) => (
              <button
                key={value}
                type="button"
                aria-pressed={side === value}
                onClick={() => setSide(value)}
                className={`oui-rounded-md oui-px-3 oui-py-1.5 oui-text-xs oui-font-semibold oui-capitalize oui-transition-colors ${
                  side === value
                    ? "oui-bg-base-5 oui-text-base-contrast"
                    : "oui-text-base-contrast-54 hover:oui-text-base-contrast-80"
                }`}
              >
                {value}
              </button>
            ))}
          </div>
        </div>

        <div className="oui-grid oui-grid-cols-1 oui-gap-3 sm:oui-grid-cols-3">
          <label className="oui-text-xs oui-text-base-contrast-54">
            Planned notional ({quote})
            <input
              aria-label={`Planned notional in ${quote}`}
              className="oui-mt-1 oui-w-full oui-rounded-lg oui-border oui-border-line-12 oui-bg-base-7 oui-px-3 oui-py-2 oui-text-sm oui-text-base-contrast-80 focus:oui-border-primary oui-outline-none"
              type="number"
              min="0"
              step="any"
              inputMode="decimal"
              placeholder="e.g. 500"
              value={notionalInput}
              onChange={(event) => setNotionalInput(event.target.value)}
            />
          </label>
          <label className="oui-text-xs oui-text-base-contrast-54">
            Stop distance (%)
            <input
              aria-label="Stop distance percentage"
              className="oui-mt-1 oui-w-full oui-rounded-lg oui-border oui-border-line-12 oui-bg-base-7 oui-px-3 oui-py-2 oui-text-sm oui-text-base-contrast-80 focus:oui-border-primary oui-outline-none"
              type="number"
              min="0"
              max="99.99"
              step="any"
              inputMode="decimal"
              placeholder="e.g. 1"
              value={stopInput}
              onChange={(event) => setStopInput(event.target.value)}
            />
          </label>
          <label className="oui-text-xs oui-text-base-contrast-54">
            Reward / risk
            <input
              aria-label="Reward to risk ratio"
              className="oui-mt-1 oui-w-full oui-rounded-lg oui-border oui-border-line-12 oui-bg-base-7 oui-px-3 oui-py-2 oui-text-sm oui-text-base-contrast-80 focus:oui-border-primary oui-outline-none"
              type="number"
              min="0"
              step="any"
              inputMode="decimal"
              value={rewardRiskInput}
              onChange={(event) => setRewardRiskInput(event.target.value)}
            />
          </label>
        </div>

        {grossStopLoss !== undefined &&
        targetProfit !== undefined &&
        stopPrice !== undefined &&
        targetPrice !== undefined ? (
          <div className="oui-mt-4 oui-grid oui-grid-cols-1 oui-gap-3 sm:oui-grid-cols-2 lg:oui-grid-cols-3">
            <RiskValue
              label="Estimated loss at stop"
              value={formatAmount(grossStopLoss, quote)}
              detail={`Stop price ${numberFormatter.format(stopPrice)} ${quote}`}
              emphasis="loss"
            />
            <RiskValue
              label="Gross target profit"
              value={formatAmount(targetProfit, quote)}
              detail={`Target price ${numberFormatter.format(targetPrice)} ${quote}`}
            />
            <RiskValue
              label="Estimated round-trip taker fees"
              value={
                estimatedRoundTripFees === undefined
                  ? "Unavailable"
                  : formatAmount(estimatedRoundTripFees, quote)
              }
              detail={
                hasTakerFeeRate
                  ? `Using ${(takerFeeRate * 100).toFixed(4)}% per side`
                  : accountInfoError
                    ? "Account fee data could not be loaded"
                    : "Waiting for account fee data"
              }
            />
            {estimatedLossIncludingFees !== undefined && (
              <RiskValue
                label="Stop loss including estimated fees"
                value={formatAmount(estimatedLossIncludingFees, quote)}
                detail="Excludes funding and slippage"
                emphasis="loss"
              />
            )}
            {estimatedNextFunding !== undefined && (
              <RiskValue
                label="Estimated next funding"
                value={`${estimatedNextFunding >= 0 ? "Cost " : "Credit "}${formatAmount(Math.abs(estimatedNextFunding), quote)}`}
                detail="Based on the current estimated funding rate"
              />
            )}
          </div>
        ) : (
          <p className="oui-mt-4 oui-rounded-lg oui-bg-base-7 oui-p-3 oui-text-xs oui-text-base-contrast-54">
            Enter a notional and a stop distance to calculate this scenario.
            Stop distance must be above 0% and below 100%.
          </p>
        )}

        <p className="oui-mt-4 oui-text-xs oui-leading-relaxed oui-text-base-contrast-36">
          Estimates assume a stop fills at its trigger and use the current mark
          price. Actual fees, funding, slippage, gaps, margin and liquidation
          can change the result. This is not financial advice or a guarantee.
        </p>
      </div>
    </details>
  );
}

function RiskValue({
  label,
  value,
  detail,
  emphasis,
}: {
  label: string;
  value: string;
  detail: string;
  emphasis?: "loss";
}) {
  return (
    <div className="oui-rounded-lg oui-border oui-border-line-12 oui-bg-base-7 oui-p-3">
      <p className="oui-text-xs oui-text-base-contrast-54">{label}</p>
      <p
        className={`oui-mt-1 oui-text-sm oui-font-semibold ${
          emphasis === "loss" ? "oui-text-red-400" : "oui-text-base-contrast-80"
        }`}
      >
        {value}
      </p>
      <p className="oui-mt-1 oui-text-xs oui-text-base-contrast-36">{detail}</p>
    </div>
  );
}
