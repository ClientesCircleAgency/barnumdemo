// @vitest-environment jsdom
import { expect, it, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { WaitingRoomCard } from './WaitingRoomCard';
import type { AppointmentRow, PatientRow } from '@/types/database';
const drag=vi.hoisted(()=>({isDragging:false}));
vi.mock('@dnd-kit/core',()=>({useDraggable:()=>({attributes:{role:'button','aria-label':'Arrastar consulta'},listeners:{},setNodeRef:()=>{},transform:null,isDragging:drag.isDragging})}));
it('opens the appointment from the card but not the drag handle or while dragging',()=>{
  const onOpen=vi.fn();
  const props={appointment:{id:'a',professional_id:'d',time:'16:00',status:'confirmed'} as AppointmentRow,patient:{name:'Paciente'} as PatientRow,professional:undefined,consultationType:undefined,getProfessional:()=>({name:'Ana',color:'#2563eb'}),onOpen};
  const view=render(<WaitingRoomCard {...props}/>);
  fireEvent.click(screen.getByRole('button',{name:'Abrir consulta de Paciente'}));
  expect(onOpen).toHaveBeenCalledTimes(1);
  fireEvent.click(screen.getByRole('button',{name:'Arrastar consulta'}));
  expect(onOpen).toHaveBeenCalledTimes(1);
  drag.isDragging=true;view.rerender(<WaitingRoomCard {...props}/>);
  fireEvent.click(screen.getByRole('button',{name:'Abrir consulta de Paciente'}));
  expect(onOpen).toHaveBeenCalledTimes(1);
  drag.isDragging=false;view.unmount();
});
