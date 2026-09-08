export const walletSummary = {
  totalBalance: 78430500,
  availableBalance: 65870500,
  pendingWithdrawals: 6250000,
  totalFundsAdded: 102450000,
  totalFundsWithdrawn: 24020000,
};

export const transactions = [
  { id: 'TRX-2024-0856', type: 'Funds Added', icon: 'arrow-down', tone: 'var(--tk-success)', desc: 'Payment from Global Haulage Ltd', sub: 'Escrow Release', party: 'Global Haulage Ltd', amt: 4250000, pos: true, status: 'Completed', date: 'May 31, 2024', time: '10:24 AM' },
  { id: 'TRX-2024-0855', type: 'Withdrawal', icon: 'arrow-up', tone: 'var(--tk-purple)', desc: 'Paid to Danjos Carriers', sub: 'Service Payment', party: 'Danjos Carriers', amt: -2180000, pos: false, status: 'Completed', date: 'May 30, 2024', time: '04:30 PM' },
  { id: 'TRX-2024-0854', type: 'Held in Escrow', icon: 'hourglass', tone: 'var(--tk-warning)', desc: 'Escrow Deposit', sub: 'ESC-2024-0891', party: 'Global Haulage Ltd', amt: -4250000, pos: false, status: 'In Escrow', date: 'May 29, 2024', time: '11:02 AM' },
  { id: 'TRX-2024-0853', type: 'Funds Added', icon: 'arrow-down', tone: 'var(--tk-success)', desc: 'Payment from Atlantic Logistics', sub: 'Invoice INV-2024-1345', party: 'Atlantic Logistics', amt: 3800000, pos: true, status: 'Completed', date: 'May 28, 2024', time: '09:15 AM' },
  { id: 'TRX-2024-0852', type: 'Withdrawal', icon: 'arrow-up', tone: 'var(--tk-purple)', desc: 'Paid to Tin Can Logistics', sub: 'Truck Assignment', party: 'Tin Can Logistics', amt: -1250000, pos: false, status: 'Pending', date: 'May 27, 2024', time: '03:40 PM' },
  { id: 'TRX-2024-0851', type: 'Adjustment', icon: 'circle-alert', tone: 'var(--tk-danger)', desc: 'Reversal of failed payment', sub: 'Reversal', party: '—', amt: 120000, pos: true, status: 'Completed', date: 'May 27, 2024', time: '01:20 PM' },
];

export const bankAccounts = [
  { bank: 'Zenith Bank Plc', mask: '**** **** **** 1234', balance: 65870500, primary: true },
  { bank: 'GTBank Plc', mask: '**** **** **** 5678', balance: 12560000, primary: false },
];
