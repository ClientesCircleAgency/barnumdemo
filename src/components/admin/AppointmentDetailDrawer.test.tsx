// @vitest-environment jsdom
import React from 'react';
import { expect, it, vi } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AppointmentDetailDrawer } from './AppointmentDetailDrawer';
const mock = vi.hoisted(() => ({
  appointment: { id:'a', patientId:'p', professionalId:'d', specialtyId:'s', consultationTypeId:'t', date:'2026-11-10', time:'09:00', duration:30, status:'confirmed' as const, version:1, createdAt:'2026-10-25', updatedAt:'2026-10-25', additionalProfessionalIds:['b'] },
  update:vi.fn().mockResolvedValue(undefined),
}));
vi.mock('@/context/ClinicContext',()=>({useClinic:()=>({appointments:[mock.appointment],getPatientById:()=>({name:'Patient'}),getProfessionalById:()=>({name:'Doctor'}),getConsultationTypeById:()=>({name:'Type'}),getSpecialtyById:()=>({name:'Dental'})})}));
vi.mock('@/hooks/useAuth',()=>({useAuth:()=>({isAdmin:true,isSecretary:false})}));
vi.mock('@/hooks/useAppointments',()=>({useUpdateAppointment:()=>({mutateAsync:mock.update}),useUpdateAppointmentStatus:()=>({mutateAsync:vi.fn()}),AppointmentChangedError:class extends Error {}}));
vi.mock('./AppointmentTeamDetails',()=>({AppointmentTeamDetails:()=>null}));
vi.mock('./SuggestAlternativesModal',()=>({SlotSubmitError:class extends Error {},SuggestAlternativesModal:({open,onSubmit}:{open:boolean;onSubmit:(slots: {date:string;time:string;professional_id:string;additional_professional_ids:string[]}[])=>Promise<void>})=>open?<button onClick={()=>onSubmit([{date:'2026-11-11',time:'10:00',professional_id:'d',additional_professional_ids:['b']}])}>Save test slot</button>:null}));
it('submits the version captured when rescheduling opened despite a realtime refresh',async()=>{
  const user=userEvent.setup();
  const initial={...mock.appointment};
  const view=render(<AppointmentDetailDrawer appointment={initial} open onOpenChange={()=>{}}/>);
  await user.click(screen.getByRole('button',{name:/Reagendar/}));
  mock.appointment={...mock.appointment,version:2,additionalProfessionalIds:[]};
  view.rerender(<AppointmentDetailDrawer appointment={initial} open onOpenChange={()=>{}}/>);
  fireEvent.click(screen.getByRole('button',{name:'Save test slot',hidden:true}));
  await waitFor(()=>expect(mock.update).toHaveBeenCalledWith(expect.objectContaining({expectedVersion:1,additionalProfessionalIds:['b']})));
  view.unmount();
});
