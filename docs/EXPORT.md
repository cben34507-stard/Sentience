# Export format

Two renderings of the same bundle. Both come from `GET /api/export`.

## JSON (`format=json`)

```jsonc
{
  "app": "sentience", "version": 1, "generatedAt": "...",
  "range": { "from": "2026-10-08", "to": "2026-10-14", "days": 7 },
  "profile": { "name": "...", "dateOfBirth": "...", "heightCm": 180, "weightKg": 78, "timezone": "Europe/London", "bio": "..." },
  "facts":   [ { "kind": "condition", "key": "ADHD", "value": "...", "source": "...", "recordedOn": "..." } ],
  "goals":   [ { "goal": {...}, "current": 7785, "target": 8000, "percent": 0.97, "streak": 3, "complete": false } ],
  "labResults": [ { "name": "Vitamin D (25-OH)", "value": 48, "unit": "nmol/L", "refLow": 50, "refHigh": 125, "takenAt": "...", "lab": "GP" } ],
  "days": [
    {
      "date": "2026-10-14",
      "events": [ { "category": "meal", "title": "Eggs on toast", "startAt": "...", "tags": ["breakfast"], "rating": null, "data": { "kcal": 561 } } ],
      "health": { "steps": 7785, "sleepMin": 460, "restingHr": 58, "hrMin": 50, "hrAvg": 71, "hrMax": 160, "hrvAvg": 56, "activeKcal": null, "workouts": [...] },
      "heartRateByHour": [55, 54, null, ...],   // 24 entries, hourly averages
      "stepsByHour":     [0, 0, null, ...]      // 24 entries, hourly sums
    }
  ]
}
```

## Markdown (`format=md`)

Written for pasting into a chat. Sections: *About me*, *Record* (grouped by kind), *Goals*, *Test results* (every result to date, newest first, with range and LOW/HIGH flag), then one block per day with the health line, the timeline (each event annotated with the hour's average heart rate vs the day's average), and an hour-by-hour table of HR and steps. It ends with a short brief on what to look for.

## A prompt that works well

> Here is a week from my life tracker. Read my profile and record first, then the days. Look for patterns across days rather than one-offs: meal timing vs mood ratings, sleep vs next-day resting HR and HRV, caffeine timing vs sleep, whether workouts land on stressful days, and how long between waking and the first meal. Tell me what's going well, what's going wrong, and suggest three small, specific changes I could try next week — and how I'd know if they worked.

The web app's **Copy for analysis** button puts the Markdown on your clipboard; add the prompt above and send.
