using System.Globalization;
using System.Text;
using TradeRecon.Domain;

namespace TradeRecon.Application.Reporting;

/// <summary>
/// Renders end-of-day reconciliation reports. Two artefacts are produced: a human-readable
/// summary and a machine-readable break register (CSV). Rendering is deterministic and
/// contains no sensitive personal data.
/// </summary>
public sealed class EndOfDayReportBuilder
{
    private static readonly CultureInfo Inv = CultureInfo.InvariantCulture;

    public const string SummaryReportName = "eod-summary";
    public const string BreakRegisterReportName = "eod-break-register";

    public string BuildSummary(ReconciliationResult result)
    {
        ArgumentNullException.ThrowIfNull(result);

        var sb = new StringBuilder();
        sb.Append("End-of-Day Reconciliation Summary\n");
        sb.Append("=================================\n");
        sb.Append($"Business date      : {result.BusinessDate:yyyy-MM-dd}\n");
        sb.Append($"Trades ingested    : {result.TradeCount.ToString(Inv)}\n");
        sb.Append($"Settlements ingested: {result.SettlementCount.ToString(Inv)}\n");
        sb.Append($"Positions ingested : {result.PositionCount.ToString(Inv)}\n");
        sb.Append($"Matched pairs      : {result.Matches.Count.ToString(Inv)}\n");
        sb.Append($"Open breaks        : {result.OpenBreaks.Count.ToString(Inv)}\n");
        sb.Append($"Overridden breaks  : {result.OverriddenBreaks.Count.ToString(Inv)}\n");
        sb.Append($"Status             : {(result.IsClean ? "CLEAN" : "BREAKS OUTSTANDING")}\n");
        sb.Append('\n');

        sb.Append("Open breaks by type\n");
        sb.Append("-------------------\n");
        var byType = result.OpenBreaks
            .GroupBy(b => b.Type)
            .OrderBy(g => g.Key)
            .ToList();
        if (byType.Count == 0)
        {
            sb.Append("(none)\n");
        }
        else
        {
            foreach (var group in byType)
            {
                sb.Append($"{group.Key,-24}: {group.Count().ToString(Inv)}\n");
            }
        }

        return sb.ToString();
    }

    public string BuildBreakRegister(ReconciliationResult result)
    {
        ArgumentNullException.ThrowIfNull(result);

        var sb = new StringBuilder();
        sb.Append("BusinessDate,BreakKey,Type,Status,Account,Instrument,Currency,TradeId,SettlementId,Difference,Detail\n");

        foreach (var b in result.Breaks)
        {
            sb.Append(string.Join(',',
                b.BusinessDate.ToString("yyyy-MM-dd"),
                Csv(b.BreakKey),
                b.Type,
                b.Status,
                Csv(b.Key.Account),
                Csv(b.Key.Instrument),
                Csv(b.Key.Currency),
                Csv(b.TradeId ?? string.Empty),
                Csv(b.SettlementId ?? string.Empty),
                b.Difference?.ToString(Inv) ?? string.Empty,
                Csv(b.Detail)));
            sb.Append('\n');
        }

        return sb.ToString();
    }

    private static string Csv(string value)
    {
        if (value.IndexOfAny(new[] { ',', '"', '\n', '\r' }) < 0)
        {
            return value;
        }

        return $"\"{value.Replace("\"", "\"\"")}\"";
    }
}
