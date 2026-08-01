(() => {
  "use strict";

  const endpoints = {
    connections: "/ui/api/profiling/connections",
    datasets: id => `/ui/api/profiling/metadata/${encodeURIComponent(id)}/datasets`,
    tables: (c,d) => `/ui/api/profiling/metadata/${encodeURIComponent(c)}/${encodeURIComponent(d)}/tables`,
    profile: "/ui/api/profiling/profile",
    workflows: "/ui/api/silver/workflows"
  };

  const $ = id => document.getElementById(id);
  const state = {step:1, profile:null, workflow:null, executionId:null, artifacts:null};
  const panels = [...document.querySelectorAll("[data-panel]")];
  const steps = [...document.querySelectorAll(".silver-step")];
  const message = $("silver-wizard-message");

  function escapeHtml(v){return String(v??"").replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;").replaceAll('"',"&quot;").replaceAll("'","&#039;");}
  function extractArray(payload, keys){if(Array.isArray(payload))return payload;for(const k of keys){if(Array.isArray(payload?.[k]))return payload[k];}return [];}
  function first(item, keys){if(typeof item==="string")return item;return keys.map(k=>item?.[k]).find(v=>v!==undefined&&v!==null&&v!=="")||"";}
  function numberOrNull(v){const n=Number(v);return v===null||v===undefined||v===""||!Number.isFinite(n)?null:n;}
  function fmt(v){return v===null||v===undefined?"No informado":new Intl.NumberFormat("es-PE").format(v);}
  function pct(v){return v===null||v===undefined?"No informado":`${Number(v).toFixed(1)}%`;}

  async function api(url, options={}){
    const response=await fetch(url,{...options,headers:{Accept:"application/json",...(options.body?{"Content-Type":"application/json"}:{}),...(options.headers||{})}});
    const contentType=response.headers.get("content-type")||"";
    const payload=contentType.includes("application/json")?await response.json():{message:await response.text()};
    if(!response.ok)throw new Error(typeof payload.detail==="string"?payload.detail:(payload.message||`HTTP ${response.status}`));
    return payload;
  }

  function showMessage(text,type="warning"){
    message.hidden=false;message.textContent=text;message.className=`message dq-message message-${type}`;message.scrollIntoView({behavior:"smooth",block:"nearest"});
  }
  function hideMessage(){message.hidden=true;}
  function mark(id,done){const e=$(id);e.classList.toggle("done",done);e.textContent=`${done?"✓":"○"} ${e.textContent.replace(/^[✓○]\s*/,"")}`;}

  function setStep(step){
    state.step=step;
    panels.forEach(p=>p.hidden=Number(p.dataset.panel)!==step);
    steps.forEach((s,i)=>{const n=i+1;s.classList.toggle("active",n===step);s.disabled=n>step;});
    $("sw-back").disabled=step===1;
    const labels={1:"Analizar fuente",2:"Crear workflow",3:"Continuar a artefactos",4:"Continuar a ejecución",5:"Finalizar"};
    $("sw-next").textContent=labels[step];
    const help={1:["Selecciona una fuente","El catálogo evita errores de escritura y reutiliza la experiencia de Data Profiling."],2:["Valida antes de crear","Comprueba columnas, tipos, volumen y completitud antes de persistir el workflow."],3:["Diseña el contrato Silver","Ajusta nombres, tipos y transformaciones con visibilidad del origen."],4:["Genera con control","DDL y paquete PySpark se generan desde el backend y quedan versionados."],5:["Ejecuta con seguridad","Valida el paquete antes de enviarlo a Dataproc y sincroniza su estado."]};
    $("sw-help-title").textContent=help[step][0];$("sw-help-text").textContent=help[step][1];
    hideMessage();
  }

  function populate(select,items,placeholder,valueKeys,labelKeys){
    select.innerHTML=`<option value="">${escapeHtml(placeholder)}</option>`;
    const seen=new Set();items.forEach(item=>{const value=first(item,valueKeys);if(!value||seen.has(value))return;seen.add(value);const o=document.createElement("option");o.value=value;o.textContent=first(item,labelKeys)||value;select.appendChild(o);});
    select.disabled=items.length===0;
  }

  async function loadConnections(){
    try{const p=await api(endpoints.connections);populate($("sw-connection"),extractArray(p,["connections","items","data"]),"Selecciona una conexión",["connection_id","id","name"],["display_name","connection_name","name","connection_id"]);}catch(e){showMessage(`No se pudieron cargar las conexiones: ${e.message}`,"error");}
  }
  async function loadDatasets(){
    $("sw-table").innerHTML='<option value="">Selecciona un dataset</option>';$("sw-table").disabled=true;
    if(!$("sw-connection").value){$("sw-dataset").innerHTML='<option value="">Selecciona una conexión</option>';$("sw-dataset").disabled=true;return;}
    try{const p=await api(endpoints.datasets($("sw-connection").value));populate($("sw-dataset"),extractArray(p,["datasets","items","data"]),"Selecciona un dataset",["dataset_id","dataset_name","name"],["display_name","dataset_name","dataset_id","name"]);}catch(e){showMessage(`No se pudieron cargar los datasets: ${e.message}`,"error");}
  }
  async function loadTables(){
    if(!$("sw-connection").value||!$("sw-dataset").value)return;
    try{const p=await api(endpoints.tables($("sw-connection").value,$("sw-dataset").value));populate($("sw-table"),extractArray(p,["tables","items","data"]),"Selecciona una tabla",["table_id","table_name","name"],["display_name","table_name","table_id","name"]);}catch(e){showMessage(`No se pudieron cargar las tablas: ${e.message}`,"error");}
  }
  function updateSourceSummary(){
    const c=$("sw-connection").value,d=$("sw-dataset").value,t=$("sw-table").value;
    $("source-summary").innerHTML=c&&d&&t?`<strong>${escapeHtml(c)}</strong><span>${escapeHtml(d)}.${escapeHtml(t)}</span>`:'<strong>Fuente pendiente</strong><span>Selecciona conexión, dataset y tabla para continuar.</span>';
    mark("check-source",Boolean(c&&d&&t));
  }

  function normalizeProfile(payload){
    const columns=extractArray(payload,["columns","profiles","column_profiles","data"]).map(c=>({name:c.column_name||c.name||c.field_name||"columna",data_type:c.data_type||c.type||"STRING",nullable:(c.nullable!==undefined?c.nullable:true),nullPercentage:numberOrNull(c.null_percentage??c.null_pct),distinctPercentage:numberOrNull(c.distinct_percentage??c.distinct_pct),semanticRole:c.semantic_role||c.role||c.business_role||"No informado"}));
    return {rowCount:numberOrNull(payload.row_count??payload.rows??payload.total_rows),columnCount:numberOrNull(payload.column_count??payload.columns_count)??columns.length,completeness:numberOrNull(payload.completeness_percentage??payload.completeness??payload.average_completeness),candidateKey:payload.candidate_key||payload.primary_key_candidate||payload.detected_key||null,columns};
  }
  function renderProfile(){
    const p=state.profile;$("sw-rows").textContent=fmt(p.rowCount);$("sw-cols").textContent=fmt(p.columnCount);$("sw-completeness").textContent=pct(p.completeness);$("sw-key").textContent=p.candidateKey||"No informado";
    $("sw-profile-columns").innerHTML=p.columns.map(c=>`<tr><td><strong>${escapeHtml(c.name)}</strong></td><td>${escapeHtml(c.data_type)}</td><td>${pct(c.nullPercentage)}</td><td>${pct(c.distinctPercentage)}</td><td>${escapeHtml(c.semanticRole)}</td></tr>`).join("");
    $("profile-progress").hidden=true;$("profile-content").hidden=false;mark("check-profile",true);
  }
  async function runProfile(){
    $("profile-progress").hidden=false;$("profile-content").hidden=true;
    const payload=await api(endpoints.profile,{method:"POST",body:JSON.stringify({connection_id:$("sw-connection").value,dataset_id:$("sw-dataset").value,table_id:$("sw-table").value,selected_columns:[]})});
    state.profile=normalizeProfile(payload);renderProfile();
  }

  async function createAndConfirmWorkflow(){
    const created=await api(endpoints.workflows,{method:"POST",body:JSON.stringify({source:{connection_id:$("sw-connection").value,project_id:$("sw-target-project").value||"proyectopersonal-480420",dataset_id:$("sw-dataset").value,table_id:$("sw-table").value},requested_by:$("sw-generated-by").value||"julio.cordova",metadata:{created_from:"silver-guided-wizard"}})});
    const schemaColumns=state.profile.columns.map((c,i)=>({name:c.name,data_type:c.data_type,nullable:c.nullable,ordinal_position:i+1}));
    state.workflow=await api(`${endpoints.workflows}/${encodeURIComponent(created.workflow_id)}/confirm-source`,{method:"POST",body:JSON.stringify({expected_version:created.version,schema_context:{columns:schemaColumns,source_api:"enterprise-dataops-platform-ui",metadata:{profiling_validated:true}},confirmed_by:$("sw-generated-by").value||"julio.cordova"})});
    $("sw-spec-id").value=state.workflow.spec_id||"";$("sw-target-table").value=`${$("sw-table").value}_silver`;renderMapping();mark("check-workflow",true);
  }

  function addMapping(c={}){
    const tr=document.createElement("tr");tr.innerHTML=`<td><select class="map-source"><option value="">Sin origen</option>${state.profile.columns.map(x=>`<option value="${escapeHtml(x.name)}" ${x.name===(c.source_column||c.name)?"selected":""}>${escapeHtml(x.name)}</option>`).join("")}</select></td><td><input class="map-name" value="${escapeHtml(c.name||"")}"></td><td><input class="map-type" value="${escapeHtml(c.data_type||"STRING")}"></td><td><input class="map-transform" value="${escapeHtml(c.transformation||"")}" placeholder="TRIM(columna)"></td><td><input class="map-nullable" type="checkbox" ${c.nullable===false?"":"checked"}></td><td><button class="enterprise-button enterprise-button-secondary silver-row-remove" type="button">×</button></td>`;
    tr.querySelector(".silver-row-remove").addEventListener("click",()=>tr.remove());$("sw-mapping-body").appendChild(tr);
  }
  function renderMapping(){$("sw-mapping-body").innerHTML="";state.profile.columns.forEach(c=>addMapping({name:c.name,data_type:c.data_type,source_column:c.name,nullable:c.nullable}));}
  function mappingColumns(){return [...$("sw-mapping-body").querySelectorAll("tr")].map(r=>({name:r.querySelector(".map-name").value.trim(),data_type:r.querySelector(".map-type").value.trim(),nullable:r.querySelector(".map-nullable").checked,source_column:r.querySelector(".map-source").value||null,transformation:r.querySelector(".map-transform").value.trim()||null})).filter(c=>c.name&&c.data_type);}

  function ensureSpec(){const id=$("sw-spec-id").value.trim();if(!id)throw new Error("El backend aún no asignó spec_id. El mapping está listo, pero la generación debe permanecer bloqueada hasta incorporar el contrato de especificación versionada.");return id;}
  function artifactRequest(includeSource){const p={mapping_version:Number($("sw-mapping-version").value),target_project:$("sw-target-project").value.trim(),target_dataset:$("sw-target-dataset").value.trim(),target_table:$("sw-target-table").value.trim(),columns:mappingColumns(),generated_by:$("sw-generated-by").value.trim(),metadata:{workflow_id:state.workflow.workflow_id,created_from:"guided-wizard"}};if(includeSource){p.source_project=state.workflow.source.project_id;p.source_dataset=state.workflow.source.dataset_id;p.source_table=state.workflow.source.table_id;p.specification={workflow_id:state.workflow.workflow_id,business_rules:state.workflow.business_rules||{}};p.quality_rules=state.workflow.quality_rules||[];}return p;}
  async function generate(kind){const spec=ensureSpec();const path=kind==="ddl"?"ddl":"generate";const result=await api(`/ui/api/silver/specs/${encodeURIComponent(spec)}/artifacts/${path}`,{method:"POST",body:JSON.stringify(artifactRequest(kind!=="ddl"))});$("sw-artifact-output").textContent=JSON.stringify(result,null,2);state.artifacts=result;mark("check-artifacts",true);}
  async function createExecution(){const spec=ensureSpec();const r=await api("/ui/api/silver/executions",{method:"POST",body:JSON.stringify({spec_id:spec,requested_by:$("sw-generated-by").value.trim()})});state.executionId=r.execution_id;$("sw-execution-output").textContent=JSON.stringify(r,null,2);["sw-validate-package","sw-submit","sw-sync"].forEach(id=>$(id).disabled=!state.executionId);mark("check-execution",true);}
  async function executionAction(action){if(!state.executionId)throw new Error("Primero crea una ejecución.");const r=await api(`/ui/api/silver/executions/${encodeURIComponent(state.executionId)}/${action}`,{method:"POST",body:"{}"});$("sw-execution-output").textContent=JSON.stringify(r,null,2);}

  async function next(){
    try{
      hideMessage();
      if(state.step===1){if(!$("sw-connection").value||!$("sw-dataset").value||!$("sw-table").value)throw new Error("Selecciona conexión, dataset y tabla.");setStep(2);await runProfile();return;}
      if(state.step===2){if(!state.profile||!state.profile.columns.length)throw new Error("El profiling debe devolver columnas antes de crear el workflow.");await createAndConfirmWorkflow();setStep(3);return;}
      if(state.step===3){if(!mappingColumns().length)throw new Error("Define al menos una columna Silver.");setStep(4);if(!$("sw-spec-id").value)showMessage("El mapping está preparado. La generación permanece bloqueada hasta que el backend asigne spec_id.","warning");return;}
      if(state.step===4){if(!state.artifacts)throw new Error("Genera al menos un artefacto antes de continuar.");setStep(5);return;}
      if(state.step===5){window.location.href=`/silver-refinement/${encodeURIComponent(state.workflow.workflow_id)}`;}
    }catch(e){showMessage(e.message,"error");}
  }

  $("sw-connection").addEventListener("change",async()=>{await loadDatasets();updateSourceSummary();});
  $("sw-dataset").addEventListener("change",async()=>{await loadTables();updateSourceSummary();});
  $("sw-table").addEventListener("change",updateSourceSummary);
  $("sw-next").addEventListener("click",next);
  $("sw-back").addEventListener("click",()=>setStep(Math.max(1,state.step-1)));
  $("sw-add-column").addEventListener("click",()=>addMapping());
  $("sw-generate-ddl").addEventListener("click",()=>generate("ddl").catch(e=>showMessage(e.message,"error")));
  $("sw-generate-package").addEventListener("click",()=>generate("package").catch(e=>showMessage(e.message,"error")));
  $("sw-create-execution").addEventListener("click",()=>createExecution().catch(e=>showMessage(e.message,"error")));
  $("sw-validate-package").addEventListener("click",()=>executionAction("validate-package").catch(e=>showMessage(e.message,"error")));
  $("sw-submit").addEventListener("click",()=>executionAction("submit").catch(e=>showMessage(e.message,"error")));
  $("sw-sync").addEventListener("click",()=>executionAction("sync-status").catch(e=>showMessage(e.message,"error")));

  setStep(1);loadConnections();
})();
