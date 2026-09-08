export const triangulationMatches = [
  {
    id: 'TRI-2026-0091', status: 'Matched',
    container: 'TCLU4821936', containerSize: "40FT High Cube",
    originJob: 'JB-2026-0801', originLabel: 'Discharge — Apapa Port, Lagos', originDate: 'May 21, 2026',
    matchedJob: 'JB-2026-0838', matchedLabel: 'Export — Onne Port, Rivers State', matchedDate: 'May 22, 2026',
    distanceSavedKm: 186, estSavings: 680000,
    foundAt: 'May 22, 2026 08:40 AM',
    history: [
      { text: 'Match confirmed and containers rerouted', time: 'May 22, 2026 09:15 AM' },
      { text: 'Match proposed by Triangulation Engine', time: 'May 22, 2026 08:40 AM' },
    ],
  },
  {
    id: 'TRI-2026-0090', status: 'Matched',
    container: 'MSKU2210475', containerSize: '20FT Standard',
    originJob: 'JB-2026-0795', originLabel: 'Discharge — Tin Can Terminal, Lagos', originDate: 'May 19, 2026',
    matchedJob: 'JB-2026-0840', matchedLabel: 'Export — Bodija Market, Ibadan', matchedDate: 'May 20, 2026',
    distanceSavedKm: 94, estSavings: 310000,
    foundAt: 'May 20, 2026 11:05 AM',
    history: [
      { text: 'Match confirmed and containers rerouted', time: 'May 20, 2026 11:40 AM' },
      { text: 'Match proposed by Triangulation Engine', time: 'May 20, 2026 11:05 AM' },
    ],
  },
  {
    id: 'TRI-2026-0088', status: 'Pending',
    container: 'TGHU8817204', containerSize: '40FT Standard',
    originJob: 'JB-2026-0782', originLabel: 'Discharge — Onne Port, Rivers State', originDate: 'May 24, 2026',
    matchedJob: null, matchedLabel: null, matchedDate: null,
    distanceSavedKm: null, estSavings: null,
    // Proposed by the engine, applied only once an admin approves the match.
    candidateMatchedJob: 'JB-2026-0844', candidateLabel: 'Export — Cold Store, Apapa', candidateDate: 'May 25, 2026',
    candidateDistanceSavedKm: 142, candidateEstSavings: 410000,
    foundAt: 'May 24, 2026 03:20 PM',
    history: [
      { text: 'Candidate match found, awaiting admin approval', time: 'May 24, 2026 03:20 PM' },
    ],
  },
  {
    id: 'TRI-2026-0085', status: 'Expired',
    container: 'TCNU5512098', containerSize: '20FT Standard',
    originJob: 'JB-2026-0760', originLabel: 'Discharge — Apapa Port, Lagos', originDate: 'May 15, 2026',
    matchedJob: null, matchedLabel: null, matchedDate: null,
    distanceSavedKm: null, estSavings: null,
    foundAt: 'May 15, 2026 10:00 AM',
    history: [
      { text: 'No export job matched within the 7-day window — expired', time: 'May 22, 2026 10:00 AM' },
      { text: 'Candidate window opened', time: 'May 15, 2026 10:00 AM' },
    ],
  },
];
