// @vitest-environment jsdom
import React from 'react';
import { expect,it,vi } from 'vitest';
import { render,screen } from '@testing-library/react';
import { DayView } from './DayView';
const professionals=[{id:'a',name:'A',color:'#000',specialty:'s',specialtyIds:['s']},{id:'b',name:'B',color:'#fff',specialty:'s',specialtyIds:['s']}];
vi.mock('@/context/ClinicContext',()=>({useClinic:()=>({getPatientById:()=>({name:'Shared patient'}),getProfessionalById:(id:string)=>professionals.find(p=>p.id===id),getConsultationTypeById:()=>({name:'Checkup'})})}));
vi.mock('@/hooks/useClinicSchedule',()=>({useClinicSchedule:()=>({workingHours:{},getTimeSlotsForDate:()=>['16:00','16:30']})}));
it('renders the same consultation in both participant columns',()=>{
  render(<DayView appointments={[{id:'one',patientId:'patient',professionalId:'a',additionalProfessionalIds:['b'],specialtyId:'s',consultationTypeId:'t',date:'2026-10-26',time:'16:00',duration:30,status:'confirmed',createdAt:'',updatedAt:''}]} professionals={professionals} onAppointmentClick={()=>{}} />);
  expect(screen.getAllByText('Shared patient')).toHaveLength(2);
  expect(screen.getAllByTitle('A (principal) · B')).toHaveLength(2);
});
