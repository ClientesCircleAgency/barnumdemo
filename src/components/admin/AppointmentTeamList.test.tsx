// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import { expect, it } from 'vitest';
import { AppointmentTeamList } from './AppointmentTeamList';
it('shows each team member on a separate row with their own colour and primary label', () => {
  const team = [{id:'a',name:'Ana',color:'#2563eb'},{id:'b',name:'Miguel',color:'#7c3aed'}];
  render(<AppointmentTeamList appointment={{professionalId:'a',additionalProfessionalIds:['b']}} getProfessional={id=>team.find(p=>p.id===id)} />);
  const rows=screen.getAllByRole('listitem');
  expect(rows).toHaveLength(2);
  expect(rows[0].textContent).toContain('Ana');
  expect(rows[0].textContent).toContain('Principal');
  expect(rows[1].textContent).toBe('Miguel');
  expect((rows[0].firstElementChild as HTMLElement).style.backgroundColor).toBe('rgb(37, 99, 235)');
  expect((rows[1].firstElementChild as HTMLElement).style.backgroundColor).toBe('rgb(124, 58, 237)');
});
