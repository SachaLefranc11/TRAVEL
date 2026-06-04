import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { Expense, ExpenseCategory } from '../../types';

const COLORS: Record<ExpenseCategory, string> = {
  TRANSPORT: '#3b82f6',
  ACCOMMODATION: '#8b5cf6',
  FOOD: '#f97316',
  ACTIVITIES: '#10b981',
  OTHER: '#6b7280',
};

const LABELS: Record<ExpenseCategory, string> = {
  TRANSPORT: 'Transport',
  ACCOMMODATION: 'Hébergement',
  FOOD: 'Nourriture',
  ACTIVITIES: 'Activités',
  OTHER: 'Autre',
};

export const ExpenseChart = ({ expenses }: { expenses: Expense[] }) => {
  const grouped = expenses.reduce((acc, e) => {
    acc[e.category] = (acc[e.category] ?? 0) + e.amount;
    return acc;
  }, {} as Record<string, number>);

  const data = Object.entries(grouped).map(([cat, value]) => ({
    name: LABELS[cat as ExpenseCategory] ?? cat,
    value: Math.round(value * 100) / 100,
    color: COLORS[cat as ExpenseCategory] ?? '#6b7280',
  }));

  if (data.length === 0) return null;

  return (
    <ResponsiveContainer width="100%" height={260}>
      <PieChart>
        <Pie data={data} cx="50%" cy="50%" innerRadius={60} outerRadius={100} paddingAngle={3} dataKey="value">
          {data.map((entry, i) => <Cell key={i} fill={entry.color} />)}
        </Pie>
        <Tooltip formatter={(v) => [`${Number(v).toFixed(2)} €`, '']} />
        <Legend />
      </PieChart>
    </ResponsiveContainer>
  );
};
