import {useState} from 'react';
import {Link} from 'react-router-dom';
import {Input} from '@/components/ui/input';
import {useTreatmentDirectory} from '@/hooks/useTreatments';
export function TreatmentDirectory(){
 const [search,setSearch]=useState('');const query=useTreatmentDirectory(search);
 return <details className="rounded-xl border bg-card p-4"><summary className="cursor-pointer font-semibold">Consultar tratamentos de outros pacientes</summary><div className="mt-4 space-y-3"><p className="text-sm text-muted-foreground">Diretório clínico de tratamentos. Apresenta apenas o nome do paciente.</p><Input aria-label="Pesquisar tratamentos por paciente" placeholder="Pesquisar pelo nome…" value={search} onChange={e=>setSearch(e.target.value)}/>{query.isLoading?<p>A pesquisar…</p>:query.isError?<p role="alert">Não foi possível carregar o diretório.</p>:<div className="grid max-h-64 gap-2 overflow-y-auto sm:grid-cols-2">{query.data?.map(p=><Link key={p.patient_id} className="rounded-lg border p-3 hover:bg-secondary" to={`/admin/pacientes/${p.patient_id}?tab=tratamentos`}>{p.patient_name}</Link>)}{!query.data?.length&&<p className="text-sm text-muted-foreground">Sem tratamentos encontrados.</p>}</div>}</div></details>;
}
