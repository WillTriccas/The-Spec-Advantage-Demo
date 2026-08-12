using System.Globalization;

namespace TradeRecon.Infrastructure.Sources;

/// <summary>
/// Minimal, allocation-friendly CSV parsing sufficient for the synthetic fixtures used by
/// this baseline. Supports double-quoted fields with escaped quotes and skips blank lines.
/// </summary>
internal static class CsvReader
{
    internal static IReadOnlyList<IReadOnlyDictionary<string, string>> Read(string content)
    {
        var rows = new List<IReadOnlyDictionary<string, string>>();
        var lines = content.Replace("\r\n", "\n").Replace('\r', '\n').Split('\n');

        string[]? header = null;
        foreach (var line in lines)
        {
            if (string.IsNullOrWhiteSpace(line))
            {
                continue;
            }

            var fields = ParseLine(line);
            if (header is null)
            {
                header = fields.Select(f => f.Trim()).ToArray();
                continue;
            }

            var row = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase);
            for (var i = 0; i < header.Length; i++)
            {
                row[header[i]] = i < fields.Count ? fields[i] : string.Empty;
            }

            rows.Add(row);
        }

        return rows;
    }

    private static List<string> ParseLine(string line)
    {
        var fields = new List<string>();
        var current = new System.Text.StringBuilder();
        var inQuotes = false;

        for (var i = 0; i < line.Length; i++)
        {
            var c = line[i];
            if (inQuotes)
            {
                if (c == '"')
                {
                    if (i + 1 < line.Length && line[i + 1] == '"')
                    {
                        current.Append('"');
                        i++;
                    }
                    else
                    {
                        inQuotes = false;
                    }
                }
                else
                {
                    current.Append(c);
                }
            }
            else if (c == '"')
            {
                inQuotes = true;
            }
            else if (c == ',')
            {
                fields.Add(current.ToString());
                current.Clear();
            }
            else
            {
                current.Append(c);
            }
        }

        fields.Add(current.ToString());
        return fields;
    }

    internal static decimal Decimal(IReadOnlyDictionary<string, string> row, string column)
        => decimal.Parse(row[column].Trim(), NumberStyles.Number, CultureInfo.InvariantCulture);

    internal static DateOnly Date(IReadOnlyDictionary<string, string> row, string column)
        => DateOnly.ParseExact(row[column].Trim(), "yyyy-MM-dd", CultureInfo.InvariantCulture);

    internal static string Text(IReadOnlyDictionary<string, string> row, string column)
        => row[column].Trim();
}
