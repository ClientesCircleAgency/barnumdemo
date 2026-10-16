# Manual appointment flow

The public booking form is separate from the staff appointment wizard.

- New appointments start with **Criar paciente** or **Paciente existente**.
- Selecting an existing patient by NIF opens the appointment details directly.
- Creating a patient saves the record first, then opens the details with that patient selected.
- Duplicate NIFs offer the existing record; failed saves keep the patient form open.
- Opening the wizard from a patient record preserves that patient and opens the details.
- Closing and reopening resets the workflow. Schedule refreshes must not reset patient selection or entered details.

Regression cause: `useClinicSchedule` returned a new callback on every render, which retriggered the wizard initialization effect. The callback is now memoized and initialization is guarded by the dialog's closed-to-open transition. The delayed reset after closing was removed to avoid clearing a quickly reopened wizard.

Validation: `npm test` runs six isolated interaction tests with synthetic patients and mocked persistence. `npm run build` passes. No real patient or appointment is created by these tests. The full TypeScript check still reports unrelated errors in `useAppointmentRequests`, `clinicSettings`, `AccountPage`, `RequestsPage`, and `WaitingRoomPage`.
