// @vitest-environment jsdom
import React, { useState } from 'react';
import { afterEach, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AppointmentProfessionalsField } from './AppointmentProfessionalsField';
afterEach(cleanup);
it('adds and removes an eligible additional professional without duplicating the primary', async () => {
  function Form() {
    const [ids,setIds] = useState<string[]>([]);
    return <><AppointmentProfessionalsField primaryProfessionalId="a" value={ids} onChange={setIds} professionals={[{id:'a',name:'A'},{id:'b',name:'B'}]} availableIds={['a','b']} /><output>{ids.join(',')}</output></>;
  }
  render(<Form />);
  const user = userEvent.setup();
  await user.click(screen.getByRole('button',{name:'Adicionar profissional'}));
  expect(screen.queryByRole('option',{name:'A'})).toBeNull();
  await user.selectOptions(screen.getByLabelText('Profissional adicional 1'),'b');
  expect(screen.getByRole('status').textContent).toBe('b');
  await user.click(screen.getByRole('button',{name:'Remover'}));
  expect(screen.queryByLabelText('Profissional adicional 1')).toBeNull();
});
