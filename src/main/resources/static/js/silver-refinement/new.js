(() => {
  "use strict";
  const endpoints={
    connections:"/ui/api/profiling/connections",
    datasets:id=>`/ui/api/profiling/metadata/${encodeURIComponent(id)}/datasets`,
    tables:(c,d)=>`/ui/api/profiling/metadata/${encodeURIComponent(c)}/${encodeURIComponent(d)}/tables`,
    profile:"/ui/api/profiling/profile",
    workflows:"/ui/api/silver/workflows",
    mappingRecommendations:id=>`/ui/api/silver/workflows/${encodeURIComponent(id)}/mapping-recommendations`,
    targetDatasets:p=>`/ui/api/silver/workflows/catalog/projects/${encodeURIComponent(p)}/datasets`,
    targetTables:(p,d)=>`/ui/api/silver/workflows/catalog/projects/${encodeURIComponent(p)}/datasets/${encodeURIComponent(d)}/tables`
  };
  const $=id=>document.getElementById(id);
  const state={
    step:1,
    profile:null,
    workflow:null,
    mappingRecommendation:null,
    loadStrategy:{type:"FULL"},
    physicalDesign:{
      partitioning:{enabled:false,column:null,granularity:"DAY"},
      clustering_columns:[]
    },
    solutionArtifacts:{},
    execution:null,
    busy:false
  };
  const panels=[...document.querySelectorAll("[data-panel]")];
  const steps=[...document.querySelectorAll(".silver-step")];
  const message=$("silver-wizard-message");
  const esc=v=>String(v??"").replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;").replaceAll('"',"&quot;").replaceAll("'","&#039;");
  const arr=(p,keys)=>Array.isArray(p)?p:(keys.map(k=>p?.[k]).find(Array.isArray)||[]);
  const first=(i,keys)=>typeof i==="string"?i:(keys.map(k=>i?.[k]).find(v=>v!==undefined&&v!==null&&v!=="")||"");
  const num=v=>v===null||v===undefined||v===""||!Number.isFinite(Number(v))?null:Number(v);
  const fmt=v=>v===null||v===undefined?"No informado":new Intl.NumberFormat("es-PE").format(v);
  const pct=v=>v===null||v===undefined?"No informado":`${Number(v).toFixed(1)}%`;
  async function api(url,options={}){const r=await fetch(url,{...options,headers:{Accept:"application/json",...(options.body?{"Content-Type":"application/json"}:{}),...(options.headers||{})}});const ct=r.headers.get("content-type")||"";const p=ct.includes("application/json")?await r.json():{message:await r.text()};if(!r.ok)throw new Error(typeof p.detail==="string"?p.detail:(p.message||`HTTP ${r.status}`));return p;}
  function show(text,type="warning"){message.hidden=false;message.textContent=text;message.className=`message dq-message message-${type}`;message.scrollIntoView({behavior:"smooth",block:"nearest"});}
  function hide(){message.hidden=true;}
  function mark(id,done){const e=$(id);if(!e)return;e.classList.toggle("done",done);e.textContent=`${done?"✓":"○"} ${e.textContent.replace(/^[✓○]\s*/,"")}`;}
  function setStep(step){state.step=step;panels.forEach(p=>p.hidden=Number(p.dataset.panel)!==step);steps.forEach((s,i)=>{const n=i+1;s.classList.toggle("active",n===step);s.disabled=n>step;});$("sw-back").disabled=step===1;const labels={1:"Analizar fuente",2:"Crear workflow",3:"Confirmar reglas",4:"Guardar contrato",5:"Aprobar calidad",6:"Continuar a ejecución",7:"Finalizar"};$("sw-next").textContent=labels[step];const help={1:["Selecciona una fuente","Usa el catálogo certificado de profiling."],2:["Valida el perfil","Confirma esquema y evidencia antes de persistir."],3:["Gobierna las reglas","Toda regla debe guardarse y confirmarse explícitamente."],4:["Diseña el contrato Silver","El backend asignará el Spec ID y versionará el mapping."],5:["Completa el gate de calidad","Los artefactos permanecen bloqueados hasta aprobar la revisión."],6:["Genera con control","DDL y PySpark se generan desde el backend."],7:["Ejecuta con seguridad","Valida antes de enviar a Dataproc."]};$("sw-help-title").textContent=help[step][0];$("sw-help-text").textContent=help[step][1];hide();}
  function populate(select,items,placeholder,valueKeys,labelKeys){select.innerHTML=`<option value="">${esc(placeholder)}</option>`;const seen=new Set();items.forEach(item=>{const value=first(item,valueKeys);if(!value||seen.has(value))return;seen.add(value);const o=document.createElement("option");o.value=value;o.textContent=first(item,labelKeys)||value;select.appendChild(o);});select.disabled=items.length===0;}
  async function loadConnections(){try{const p=await api(endpoints.connections);populate($("sw-connection"),arr(p,["connections","items","data"]),"Selecciona una conexión",["connection_id","id","name"],["display_name","connection_name","name","connection_id"]);}catch(e){show(`No se pudieron cargar las conexiones: ${e.message}`,"error");}}
  async function loadDatasets(){
    $("sw-table").innerHTML='<option value="">Selecciona un dataset</option>';
    $("sw-table").disabled=true;

    if(!$("sw-connection").value){
      $("sw-dataset").innerHTML='<option value="">Selecciona una conexión</option>';
      $("sw-dataset").disabled=true;
      updateTargetSummary();
      return;
    }

    const payload=await api(endpoints.datasets($("sw-connection").value));
    const items=arr(payload,["datasets","items","data"]);

    populate(
      $("sw-dataset"),
      items,
      "Selecciona un dataset",
      ["dataset_id","dataset_name","name"],
      ["display_name","dataset_name","dataset_id","name"]
    );

    const metadata=new Map(
      items.map(item=>[
        String(item.dataset_id||item.dataset_name||item.name||""),
        item
      ])
    );

    Array.from($("sw-dataset").options).forEach(option=>{
      const item=metadata.get(option.value);
      if(item) option.dataset.location=item.location||"";
    });

    updateTargetSummary();
  }
  async function loadTables(){if(!$("sw-connection").value||!$("sw-dataset").value)return;const p=await api(endpoints.tables($("sw-connection").value,$("sw-dataset").value));populate($("sw-table"),arr(p,["tables","items","data"]),"Selecciona una tabla",["table_id","table_name","name"],["display_name","table_name","table_id","name"]);}
  function renderTargetOptions(select,items,placeholder,valueKey,labelKey){
    select.innerHTML=`<option value="">${esc(placeholder)}</option>`;

    items.forEach(item=>{
      const option=document.createElement("option");
      option.value=String(item[valueKey]||"");
      option.textContent=String(item[labelKey]||item[valueKey]||"");
      option.dataset.location=item.location||"";
      select.appendChild(option);
    });

    select.disabled=items.length===0;
  }

  function targetLocationStatus(){
    const source=(
      $("sw-dataset").selectedOptions[0]?.dataset.location||
      state.profile?.location||
      state.profile?.source_location||
      ""
    ).trim();

    const target=(
      $("sw-target-dataset").selectedOptions[0]?.dataset.location||
      ""
    ).trim();

    if(!source||!target){
      return {compatible:null,source,target};
    }

    return {
      compatible:source.toUpperCase()===target.toUpperCase(),
      source,
      target
    };
  }

  function targetLocationCompatible(){
    return targetLocationStatus().compatible!==false;
  }

  function updateTargetSummary(){
    const summary=$("target-summary");
    if(!summary) return;

    const project=$("sw-target-project").value.trim();
    const dataset=$("sw-target-dataset").value;
    const table=$("sw-target-table").value;
    const location=targetLocationStatus();

    if(!project||!dataset||!table){
      summary.innerHTML=
        '<strong>Destino pendiente</strong>'+
        '<span>Selecciona proyecto, dataset y tabla destino.</span>';
      return;
    }

    let locationText="Ubicación pendiente de validación.";

    if(location.compatible===true){
      locationText=`Ubicación compatible: ${location.source}.`;
    }else if(location.compatible===false){
      locationText=
        `Ubicación incompatible: fuente ${location.source} / destino ${location.target}.`;
    }

    summary.innerHTML=
      `<strong>${esc(project)}.${esc(dataset)}.${esc(table)}</strong>`+
      `<span>${esc(locationText)}</span>`;
  }

  async function loadTargetDatasets(){
    const project=$("sw-target-project").value.trim();
    const datasetSelect=$("sw-target-dataset");
    const tableSelect=$("sw-target-table");
    const previousDataset=datasetSelect.value;

    tableSelect.innerHTML=
      '<option value="">Selecciona un dataset destino</option>';
    tableSelect.disabled=true;

    if(!project){
      datasetSelect.innerHTML=
        '<option value="">Informa el proyecto destino</option>';
      datasetSelect.disabled=true;
      updateTargetSummary();
      return;
    }

    const payload=await api(endpoints.targetDatasets(project));
    const items=arr(payload,["datasets","items","data"]);

    renderTargetOptions(
      datasetSelect,
      items,
      "Selecciona un dataset destino",
      "dataset_id",
      "dataset_id"
    );

    const available=new Set(items.map(item=>String(item.dataset_id||"")));
    const preferred=[
      previousDataset,
      "silver",
      "demo_silver",
      "seguros_silver"
    ].find(value=>value&&available.has(value));

    if(preferred) datasetSelect.value=preferred;

    await loadTargetTables();
  }

  async function loadTargetTables(){
    const project=$("sw-target-project").value.trim();
    const dataset=$("sw-target-dataset").value;
    const tableSelect=$("sw-target-table");
    const previousTable=tableSelect.value;

    tableSelect.innerHTML=
      '<option value="">Selecciona una tabla destino</option>';
    tableSelect.disabled=true;

    if(!project||!dataset){
      updateTargetSummary();
      return;
    }

    const payload=await api(endpoints.targetTables(project,dataset));
    const items=arr(payload,["tables","items","data"]);

    renderTargetOptions(
      tableSelect,
      items,
      "Selecciona una tabla destino",
      "table_id",
      "table_id"
    );

    const available=new Set(items.map(item=>String(item.table_id||"")));
    const suggestedSource=$("sw-table").value;
    const suggestedTable=suggestedSource?`${suggestedSource}_silver`:"";

    const preferred=[
      previousTable,
      suggestedTable
    ].find(value=>value&&available.has(value));

    if(preferred) tableSelect.value=preferred;

    updateTargetSummary();
  }
  function updateSourceSummary(){const c=$("sw-connection").value,d=$("sw-dataset").value,t=$("sw-table").value;$("source-summary").innerHTML=c&&d&&t?`<strong>${esc(c)}</strong><span>${esc(d)}.${esc(t)}</span>`:'<strong>Fuente pendiente</strong><span>Selecciona conexión, dataset y tabla.</span>';mark("check-source",Boolean(c&&d&&t));}
  function normalizeProfile(p){const columns=arr(p,["columns","profiles","column_profiles","data"]).map(c=>({name:c.column_name||c.name||c.field_name||"columna",data_type:c.data_type||c.type||"STRING",nullable:c.nullable!==undefined?c.nullable:true,nullPercentage:num(c.null_percentage??c.null_pct),distinctPercentage:num(c.distinct_percentage??c.distinct_pct),semanticRole:c.semantic_role||c.role||c.business_role||"No informado"}));return{rowCount:num(p.row_count??p.rows??p.total_rows),columnCount:num(p.column_count??p.columns_count)??columns.length,completeness:num(p.completeness_percentage??p.completeness??p.average_completeness),candidateKey:p.candidate_key||p.primary_key_candidate||p.detected_key||null,columns};}
  function renderProfile(){const p=state.profile;$("sw-rows").textContent=fmt(p.rowCount);$("sw-cols").textContent=fmt(p.columnCount);$("sw-completeness").textContent=pct(p.completeness);$("sw-key").textContent=p.candidateKey||"No informado";$("sw-profile-columns").innerHTML=p.columns.map(c=>`<tr><td><strong>${esc(c.name)}</strong></td><td>${esc(c.data_type)}</td><td>${pct(c.nullPercentage)}</td><td>${pct(c.distinctPercentage)}</td><td>${esc(c.semanticRole)}</td></tr>`).join("");$("profile-progress").hidden=true;$("profile-content").hidden=false;mark("check-profile",true);}
  async function runProfile(){$("profile-progress").hidden=false;$("profile-content").hidden=true;state.profile=normalizeProfile(await api(endpoints.profile,{method:"POST",body:JSON.stringify({connection_id:$("sw-connection").value,dataset_id:$("sw-dataset").value,table_id:$("sw-table").value,selected_columns:[]})}));renderProfile();}
  async function createAndConfirmWorkflow(){const created=await api(endpoints.workflows,{method:"POST",body:JSON.stringify({source:{connection_id:$("sw-connection").value,project_id:$("sw-target-project").value||"proyectopersonal-480420",dataset_id:$("sw-dataset").value,table_id:$("sw-table").value},requested_by:$("sw-generated-by").value||"julio.cordova",metadata:{created_from:"silver-guided-wizard"}})});const schemaColumns=state.profile.columns.map((c,i)=>({name:c.name,data_type:c.data_type,nullable:c.nullable,ordinal_position:i+1}));state.workflow=await api(`${endpoints.workflows}/${encodeURIComponent(created.workflow_id)}/confirm-source`,{method:"POST",body:JSON.stringify({expected_version:created.version,schema_context:{columns:schemaColumns,source_api:"enterprise-dataops-platform-ui",metadata:{profiling_validated:true}},confirmed_by:$("sw-generated-by").value||"julio.cordova"})});renderMapping();updateTargetSummary();addRule();mark("check-workflow",true);}
  function addRule(rule={}){const tr=document.createElement("tr");const opts=state.profile.columns.map(c=>`<option value="${esc(c.name)}">${esc(c.name)}</option>`).join("");tr.innerHTML=`<td><input class="rule-name" value="${esc(rule.name||"")}" placeholder="Normalizar campo"></td><td><select class="rule-type"><option value="TRANSFORMATION">TRANSFORMATION</option><option value="DEFAULT_VALUE">DEFAULT_VALUE</option><option value="VALIDATION">VALIDATION</option></select></td><td><input class="rule-expression" value="${esc(rule.expression||"")}" placeholder="TRIM(columna)"></td><td><select class="rule-source">${opts}</select></td><td><select class="rule-target">${opts}</select></td><td><select class="rule-severity"><option value="ERROR">ERROR</option><option value="WARNING">WARNING</option><option value="INFO">INFO</option></select></td><td><button class="enterprise-button enterprise-button-secondary rule-remove" type="button">×</button></td>`;tr.querySelector(".rule-remove").addEventListener("click",()=>tr.remove());$("sw-rules-body").appendChild(tr);}
  function businessRules(){return [...$("sw-rules-body").querySelectorAll("tr")].map((r,i)=>{const source=r.querySelector(".rule-source").value,target=r.querySelector(".rule-target").value,name=r.querySelector(".rule-name").value.trim(),expression=r.querySelector(".rule-expression").value.trim();return{rule_id:`BR-UI-${String(i+1).padStart(3,"0")}`,name,description:name,rule_type:r.querySelector(".rule-type").value,expression,severity:r.querySelector(".rule-severity").value,enabled:true,source_columns:[source],target_columns:[target],business_owner:"Data Owner",technical_owner:"Data Engineering",rationale:$("sw-rules-reason").value.trim(),examples:[],metadata:{created_from:"silver-guided-wizard"}};}).filter(r=>r.name&&r.expression);}
  async function saveRules(){const rules=businessRules();if(!rules.length)throw new Error("Define al menos una Business Rule válida.");state.workflow=await api(`${endpoints.workflows}/${encodeURIComponent(state.workflow.workflow_id)}/business-rules/draft`,{method:"PUT",body:JSON.stringify({expected_version:state.workflow.version,rules,authored_by:$("sw-generated-by").value.trim(),change_reason:$("sw-rules-reason").value.trim()})});$("sw-rules-output").textContent=JSON.stringify(state.workflow.business_rules,null,2);$("sw-confirm-rules").disabled=false;}
  async function confirmRules(){state.workflow=await api(`${endpoints.workflows}/${encodeURIComponent(state.workflow.workflow_id)}/business-rules/confirm`,{method:"POST",body:JSON.stringify({expected_version:state.workflow.version,confirmed_by:$("sw-generated-by").value.trim(),confirmation_reason:$("sw-rules-reason").value.trim()})});$("sw-rules-output").textContent=JSON.stringify(state.workflow.business_rules,null,2);mark("check-rules",true);}
  function addMapping(c={}){
    const tr=document.createElement("tr");

    const transformation=
      typeof c.transformation==="object"
        ?c.transformation?.type||"DIRECT"
        :c.transformation||"";

    const confidence=
      c.confidence===null||c.confidence===undefined
        ?"Manual"
        :`${Math.round(Number(c.confidence)*100)}%`;

    const risk=c.risk||"Sin riesgo informado";
    const approval=c.requires_approval?"Requiere revisión":"No requerida";

    tr.innerHTML=`
      <td>
        <select class="map-source">
          <option value="">Sin origen</option>
          ${state.profile.columns.map(x=>`
            <option value="${esc(x.name)}"
              ${x.name===(c.source_column||c.name)?"selected":""}>
              ${esc(x.name)}
            </option>`).join("")}
        </select>
      </td>
      <td><input class="map-name" value="${esc(c.name||"")}"></td>
      <td><input class="map-type" value="${esc(c.data_type||"STRING")}"></td>
      <td>
        <input class="map-transform"
               value="${esc(transformation)}"
               placeholder="DIRECT / TRIM / CAST">
      </td>
      <td><input class="map-nullable" type="checkbox"
        ${c.nullable===false?"":"checked"}></td>
      <td><strong>${esc(confidence)}</strong></td>
      <td>${esc(risk)}</td>
      <td>${esc(approval)}</td>
      <td>
        <button class="enterprise-button enterprise-button-secondary map-remove"
                type="button">×</button>
      </td>`;

    tr.querySelector(".map-remove")
      .addEventListener("click",()=>tr.remove());

    $("sw-mapping-body").appendChild(tr);
  }

  function renderMapping(){
    $("sw-mapping-body").innerHTML="";
    state.profile.columns.forEach(c=>addMapping({
      name:c.name,
      data_type:c.data_type,
      source_column:c.name,
      nullable:c.nullable
    }));
  }
  function mappingColumns(){return [...$("sw-mapping-body").querySelectorAll("tr")].map(r=>({name:r.querySelector(".map-name").value.trim(),data_type:r.querySelector(".map-type").value.trim(),nullable:r.querySelector(".map-nullable").checked,source_column:r.querySelector(".map-source").value||null,transformation:r.querySelector(".map-transform").value.trim()||null})).filter(c=>c.name&&c.data_type&&(c.source_column||c.transformation));}

  function renderStrategy(){
    const strategy=state.loadStrategy||{type:"FULL"};
    const design=state.physicalDesign||{};
    const partition=design.partitioning||{};
    const clustering=design.clustering_columns||[];

    $("sw-strategy-panel").hidden=false;
    $("sw-load-strategy").textContent=strategy.type||"FULL";
    $("sw-watermark-column").textContent=
      strategy.watermark_column||"No aplica";

    $("sw-partition-column").textContent=
      partition.enabled
        ?`${partition.column||"—"} · ${partition.granularity||"DAY"}`
        :"Sin particionamiento";

    $("sw-clustering-columns").textContent=
      clustering.length
        ?clustering.join(", ")
        :"Sin clustering";
  }

  async function recommendMapping(){
    if(!state.workflow?.workflow_id){
      throw new Error("Primero crea y confirma el workflow Silver.");
    }

    const targetProject=$("sw-target-project").value.trim();
    const targetDataset=$("sw-target-dataset").value;
    const targetTable=$("sw-target-table").value;

    if(!targetProject||!targetDataset||!targetTable){
      throw new Error(
        "Selecciona proyecto, dataset y tabla destino antes de recomendar el mapping."
      );
    }

    state.busy=true;
    const button=$("sw-recommend-mapping");

    if(button){
      button.disabled=true;
      button.textContent="Analizando mapping...";
    }

    try{
      const recommendation=await api(
        endpoints.mappingRecommendations(state.workflow.workflow_id),
        {
          method:"POST",
          body:JSON.stringify({
            expected_version:state.workflow.version,
            target_project:targetProject,
            target_dataset:targetDataset,
            target_table:targetTable
          })
        }
      );

      state.mappingRecommendation=recommendation;
      state.loadStrategy=recommendation.load_strategy||{type:"FULL"};
      state.physicalDesign=recommendation.physical_design||{
        partitioning:{enabled:false,column:null,granularity:"DAY"},
        clustering_columns:[]
      };

      $("sw-mapping-body").innerHTML="";

      (recommendation.columns||[])
        .filter(column=>column.include!==false)
        .forEach(column=>addMapping({
          source_column:column.source_column,
          name:column.target_column,
          data_type:column.target_type,
          nullable:column.nullable,
          transformation:column.transformation,
          confidence:column.confidence,
          risk:column.risk,
          requires_approval:column.requires_approval
        }));

      renderStrategy();

      $("sw-contract-output").textContent=JSON.stringify({
        recommendation_engine:recommendation.recommendation_engine,
        source_workflow_version:recommendation.source_workflow_version,
        requires_human_approval:recommendation.requires_human_approval,
        load_strategy:state.loadStrategy,
        physical_design:state.physicalDesign
      },null,2);

      show(
        `Mapping recomendado. Estrategia: ${state.loadStrategy.type||"FULL"}.`,
        "success"
      );

    }finally{
      state.busy=false;

      if(button){
        button.disabled=false;
        button.textContent="Recomendar mapping";
      }
    }
  }
  async function saveContract(){
    const columns=mappingColumns();
    const targetProject=$("sw-target-project").value.trim();
    const targetDataset=$("sw-target-dataset").value;
    const targetTable=$("sw-target-table").value;

    if(!columns.length){
      throw new Error("Define al menos una columna Silver.");
    }

    if(!targetProject||!targetDataset||!targetTable){
      throw new Error("Selecciona proyecto, dataset y tabla destino.");
    }

    if(!targetLocationCompatible()){
      const location=targetLocationStatus();
      throw new Error(
        `La ubicación fuente ${location.source} no es compatible con `+
        `la ubicación destino ${location.target}.`
      );
    }

    state.workflow=await api(
      `${endpoints.workflows}/${encodeURIComponent(state.workflow.workflow_id)}/specification`,
      {
        method:"POST",
        body:JSON.stringify({
          expected_version:state.workflow.version,
          mapping_version:Number($("sw-mapping-version").value),
          target:{
            project_id:targetProject,
            dataset_id:targetDataset,
            table_id:targetTable
          },
          columns,
          created_by:$("sw-generated-by").value.trim(),
          change_reason:"Contrato Silver aprobado desde el wizard"
        })
      }
    );

    $("sw-spec-id").value=state.workflow.spec_id||"";
    $("sw-contract-output").textContent=JSON.stringify({
      spec_id:state.workflow.spec_id,
      mapping_version:state.workflow.mapping_version,
      silver_target:state.workflow.silver_target,
      version:state.workflow.version,
      active_step:state.workflow.active_step
    },null,2);

    $("sw-quality-summary").textContent=
      `Spec ${state.workflow.spec_id} · `+
      `${state.workflow.silver_target.project_id}.`+
      `${state.workflow.silver_target.dataset_id}.`+
      `${state.workflow.silver_target.table_id}`;

    mark("check-contract",true);
  }
  async function confirmQuality(){state.workflow=await api(`${endpoints.workflows}/${encodeURIComponent(state.workflow.workflow_id)}/quality-review`,{method:"POST",body:JSON.stringify({expected_version:state.workflow.version,decision:$("sw-quality-decision").value,reviewed_by:$("sw-generated-by").value.trim(),review_notes:$("sw-quality-notes").value.trim(),quality_rules:[]})});$("sw-quality-output").textContent=JSON.stringify({version:state.workflow.version,active_step:state.workflow.active_step,available_actions:state.workflow.available_actions,quality_rules:state.workflow.quality_rules},null,2);mark("check-quality",true);}

  function ensureSpec(){
    const id=$("sw-spec-id").value.trim();
    if(!id){
      throw new Error("Guarda el contrato Silver antes de continuar.");
    }
    return id;
  }

const artifactConfig={
    NOTEBOOK:{
      key:"notebook",
      contentType:"NOTEBOOK"
    },
    PYSPARK_SCRIPT:{
      key:"script",
      contentType:"PYSPARK_SCRIPT"
    },
    SILVER_DDL:{
      key:"ddl",
      contentType:"SILVER_DDL"
    },
    ARTIFACT_PACKAGE:{
      key:"package",
      contentType:"MANIFEST_JSON"
    }
  };

  function artifactRequest(){
    return {
      mapping_version:Number($("sw-mapping-version").value),
      target_project:$("sw-target-project").value.trim(),
      target_dataset:$("sw-target-dataset").value.trim(),
      target_table:$("sw-target-table").value.trim(),
      columns:mappingColumns(),
      load_strategy:state.loadStrategy||{type:"FULL"},
      physical_design:state.physicalDesign||{
        partitioning:{enabled:false,column:null,granularity:"DAY"},
        clustering_columns:[]
      },
      generated_by:$("sw-generated-by").value.trim(),
      source_project:state.workflow.source.project_id,
      source_dataset:state.workflow.source.dataset_id,
      source_table:state.workflow.source.table_id,
      specification:{
        workflow_id:state.workflow.workflow_id,
        business_rules:state.workflow.business_rules||{}
      },
      quality_rules:state.workflow.quality_rules||[],
      metadata:{
        workflow_id:state.workflow.workflow_id,
        created_from:"guided-wizard"
      }
    };
  }

  function artifactItems(payload){
    if(Array.isArray(payload)) return payload;
    if(Array.isArray(payload?.artifacts)) return payload.artifacts;
    if(Array.isArray(payload?.items)) return payload.items;
    if(Array.isArray(payload?.data)) return payload.data;
    return [];
  }

  function currentArtifact(items,type){
    return items
      .filter(item=>item?.artifact_type===type)
      .sort(
        (a,b)=>
          Number(b.artifact_version||0)-
          Number(a.artifact_version||0)
      )[0]||null;
  }

  function gcsConsoleUrl(uri){
    if(!String(uri||"").startsWith("gs://")) return "";

    const value=String(uri).slice(5);
    const separator=value.indexOf("/");

    if(separator<1) return "";

    const bucket=value.slice(0,separator);
    const object=value.slice(separator+1);

    return (
      "https://console.cloud.google.com/storage/browser/"+
      encodeURIComponent(bucket)+
      "?project=proyectopersonal-480420&prefix="+
      encodeURIComponent(object)
    );
  }

  function renderArtifactCard(type,record){
    const config=artifactConfig[type];
    const status=$(`sw-${config.key}-status`);
    const meta=$(`sw-${config.key}-meta`);
    const view=$(`sw-view-${config.key}`);
    const link=$(`sw-open-${config.key}`);

    if(!record){
      status.textContent="○ No generado";
      view.disabled=true;
      link.hidden=true;
      return;
    }

    status.textContent="✓ Generado";
    meta.textContent=
      `${record.artifact_name||type} · `+
      `Versión ${record.artifact_version||"—"} · `+
      `${record.generation_status||"GENERATED"}`;

    view.disabled=false;

    const url=gcsConsoleUrl(record.storage_uri);

    if(url){
      link.href=url;
      link.hidden=false;
    }else{
      link.hidden=true;
    }
  }

  function allArtifactsReady(){
    return Object.keys(artifactConfig).every(
      type=>Boolean(state.solutionArtifacts[type])
    );
  }

  async function refreshArtifacts(){
    const spec=ensureSpec();

    const payload=await api(
      `/ui/api/silver/specs/${encodeURIComponent(spec)}/artifacts`
    );

    const items=artifactItems(payload);
    const artifacts={};

    Object.keys(artifactConfig).forEach(type=>{
      artifacts[type]=currentArtifact(items,type);
      renderArtifactCard(type,artifacts[type]);
    });

    state.solutionArtifacts=artifacts;
    mark("check-artifacts",allArtifactsReady());
    syncJourneyButtons();
  }

  function notebookPreview(content){
    try{
      const notebook=JSON.parse(content);

      if(!Array.isArray(notebook.cells)){
        return JSON.stringify(notebook,null,2);
      }

      return notebook.cells.map((cell,index)=>{
        const source=Array.isArray(cell.source)
          ?cell.source.join("")
          :String(cell.source||"");

        return `# Celda ${index+1} · ${cell.cell_type}\n${source}`;
      }).join("\n\n");
    }catch(_){
      return content;
    }
  }

  async function viewArtifact(type){
    const record=state.solutionArtifacts[type];

    if(!record){
      throw new Error("Este artefacto todavía no fue generado.");
    }

    const config=artifactConfig[type];
    const output=$(`sw-${config.key}-output`);
    const spec=ensureSpec();

    output.hidden=false;
    output.textContent="Cargando contenido...";

    const response=await api(
      `/ui/api/silver/specs/${encodeURIComponent(spec)}`+
      `/artifacts/current/${encodeURIComponent(config.contentType)}`+
      `/content`
    );

    let content=String(response.content||"");

    if(type==="NOTEBOOK"){
      content=notebookPreview(content);
    }else if(type==="ARTIFACT_PACKAGE"){
      try{
        content=JSON.stringify(JSON.parse(content),null,2);
      }catch(_){
        // Mantener texto original.
      }
    }

    output.textContent=content||"Contenido no informado.";
  }

  function executionStatus(){
    return String(state.execution?.status||"").toUpperCase();
  }

  function renderExecutionProgress(){
    const status=executionStatus();
    const created=Boolean(state.execution);
    const validated=["VALIDATED","QUEUED","SUBMITTED","RUNNING","SUCCEEDED"].includes(status);
    const submitted=["QUEUED","SUBMITTED","RUNNING","SUCCEEDED"].includes(status);
    const finished=status==="SUCCEEDED";

    const messages={
      "":"1 de 4 · Crea la ejecución",
      "PENDING":"2 de 4 · Valida el paquete",
      "VALIDATED":"3 de 4 · Listo para ejecutar en Dataproc",
      "QUEUED":"4 de 4 · Dataproc está en cola",
      "SUBMITTED":"4 de 4 · Enviado a Dataproc",
      "RUNNING":"4 de 4 · Dataproc está procesando",
      "SUCCEEDED":"Ejecución completada correctamente",
      "FAILED":"La ejecución falló; revisa el detalle técnico"
    };

    let panel=$("sw-execution-progress");

    if(!panel){
      panel=document.createElement("div");
      panel.id="sw-execution-progress";
      panel.style.cssText=
        "margin:1rem 0;padding:1rem;border:1px solid #ddd;"+
        "border-radius:12px;background:#f7f7f7";
      $("sw-execution-output").before(panel);
    }

    panel.innerHTML=`
      <strong>Subpaso actual: ${messages[status]||`Estado ${status}`}</strong>
      <div class="silver-checklist" style="margin-top:.75rem">
        <span>${created?"✓":"→"} 1. Crear ejecución</span>
        <span>${validated?"✓":status==="PENDING"?"→":"○"} 2. Validar paquete</span>
        <span>${submitted?"✓":status==="VALIDATED"?"→":"○"} 3. Ejecutar Dataproc</span>
        <span>${finished?"✓":submitted?"→":"○"} 4. Actualizar estado</span>
      </div>
    `;
  }

  function syncJourneyButtons(){
    const status=executionStatus();
    const generate=$("sw-generate-solution");

    if(generate){
      generate.disabled=state.busy;
      generate.textContent=state.busy
        ?"Generando solución..."
        :allArtifactsReady()
          ?"Regenerar nueva versión"
          :"Generar solución PySpark";
    }

    Object.entries(artifactConfig).forEach(([type,config])=>{
      const button=$(`sw-view-${config.key}`);
      if(button) button.disabled=!state.solutionArtifacts[type];
    });

    const create=$("sw-create-execution");
    const validate=$("sw-validate-package");
    const submit=$("sw-submit");
    const sync=$("sw-sync");

    create.disabled=
      state.busy||
      !state.solutionArtifacts.ARTIFACT_PACKAGE||
      (Boolean(state.execution)&&!["FAILED","SUCCEEDED"].includes(status));

    validate.disabled=state.busy||status!=="PENDING";
    submit.disabled=state.busy||status!=="VALIDATED";

    sync.disabled=
      state.busy||
      !state.execution?.dataproc_batch_id||
      !["QUEUED","SUBMITTED","RUNNING"].includes(status);

    [create,validate,submit,sync].forEach(button=>{
      button.classList.remove("enterprise-button-primary");
      button.classList.add("enterprise-button-secondary");
    });

    const active=
      !state.execution?create:
      status==="PENDING"?validate:
      status==="VALIDATED"?submit:
      ["QUEUED","SUBMITTED","RUNNING"].includes(status)?sync:
      null;

    if(active){
      active.classList.remove("enterprise-button-secondary");
      active.classList.add("enterprise-button-primary");
    }

    if(state.step===7){
      $("sw-next").disabled=status!=="SUCCEEDED";
    }

    renderExecutionProgress();
  }

  async function generateSolution(){
    if(state.workflow.active_step<6){
      throw new Error(
        "Confirma la revisión de calidad antes de generar la solución."
      );
    }

    if(state.busy) return;

    const spec=ensureSpec();

    state.busy=true;
    syncJourneyButtons();

    Object.values(artifactConfig).forEach(config=>{
      $(`sw-${config.key}-status`).textContent="◌ Generando...";
    });

    try{
      const result=await api(
        `/ui/api/silver/specs/${encodeURIComponent(spec)}`+
        `/artifacts/generate`,
        {
          method:"POST",
          body:JSON.stringify(artifactRequest())
        }
      );

      $("sw-artifact-technical-output").textContent=
        JSON.stringify(result,null,2);

      await refreshArtifacts();

      if(!allArtifactsReady()){
        throw new Error(
          "La operación terminó, pero no se encontraron los cuatro artefactos."
        );
      }

      show(
        "Solución PySpark generada correctamente.",
        "success"
      );
    }finally{
      state.busy=false;
      syncJourneyButtons();
    }
  }


  async function createExecution(){
    if(!state.solutionArtifacts.ARTIFACT_PACKAGE){
      throw new Error(
        "Genera la solución PySpark antes de crear la ejecución."
      );
    }

    if(state.busy) return;

    const spec=ensureSpec();

    state.busy=true;
    syncJourneyButtons();

    try{
      state.execution=await api(
        "/ui/api/silver/executions",
        {
          method:"POST",
          body:JSON.stringify({
            spec_id:spec,
            requested_by:$("sw-generated-by").value.trim()
          })
        }
      );

      $("sw-execution-output").textContent=
        JSON.stringify(state.execution,null,2);

      mark("check-execution",true);
    }finally{
      state.busy=false;
      syncJourneyButtons();
    }
  }

  async function executionAction(action){
    const executionId=state.execution?.execution_id;
    const status=executionStatus();

    if(!executionId){
      throw new Error("Primero crea una ejecución.");
    }

    if(action==="validate-package"&&status!=="PENDING"){
      throw new Error(
        `El paquete solo puede validarse desde PENDING; estado actual=${status}.`
      );
    }

    if(action==="submit"&&status!=="VALIDATED"){
      throw new Error(
        `Dataproc solo puede ejecutarse desde VALIDATED; estado actual=${status}.`
      );
    }

    if(state.busy) return;

    state.busy=true;
    syncJourneyButtons();

    try{
      const result=await api(
        `/ui/api/silver/executions/${encodeURIComponent(executionId)}/${action}`,
        {
          method:"POST",
          body:"{}"
        }
      );

      const updatedExecution=result?.execution||result;

      state.execution={
        ...state.execution,
        ...updatedExecution
      };

      $("sw-execution-output").textContent=
        JSON.stringify(state.execution,null,2);
    }finally{
      state.busy=false;
      syncJourneyButtons();
    }
  }

  async function next(){try{hide();if(state.step===1){if(!$("sw-connection").value||!$("sw-dataset").value||!$("sw-table").value)throw new Error("Selecciona conexión, dataset y tabla.");setStep(2);await runProfile();return;}if(state.step===2){if(!state.profile?.columns?.length)throw new Error("El profiling debe devolver columnas.");await createAndConfirmWorkflow();setStep(3);return;}if(state.step===3){if(state.workflow.active_step!==4)throw new Error("Guarda y confirma las Business Rules antes de continuar.");setStep(4);return;}if(state.step===4){if(!state.workflow.spec_id)throw new Error("Guarda el contrato Silver antes de continuar.");setStep(5);return;}if(state.step===5){if(state.workflow.active_step<6)throw new Error("Confirma la revisión de calidad antes de continuar.");setStep(6);return;}if(state.step===6){if(!allArtifactsReady())throw new Error("Genera los cuatro artefactos antes de continuar.");setStep(7);syncJourneyButtons();return;}if(state.step===7){if(executionStatus()!=="SUCCEEDED")throw new Error(`La ejecución debe finalizar en SUCCEEDED; estado actual=${executionStatus()||"NO CREADA"}.`);window.location.href=`/silver-refinement/${encodeURIComponent(state.workflow.workflow_id)}`;}}catch(e){show(e.message,"error");}}
  $("sw-connection").addEventListener("change",async()=>{
    try{
      await loadDatasets();
      updateSourceSummary();
      updateTargetSummary();
    }catch(e){
      show(e.message,"error");
    }
  });

  $("sw-dataset").addEventListener("change",async()=>{
    try{
      await loadTables();
      updateSourceSummary();
      updateTargetSummary();
    }catch(e){
      show(e.message,"error");
    }
  });

  $("sw-table").addEventListener("change",async()=>{
    updateSourceSummary();
    try{
      await loadTargetTables();
    }catch(e){
      show(e.message,"error");
    }
  });

  $("sw-target-project").addEventListener("change",()=>{
    loadTargetDatasets().catch(e=>show(e.message,"error"));
  });

  $("sw-target-dataset").addEventListener("change",()=>{
    loadTargetTables().catch(e=>show(e.message,"error"));
  });

  $("sw-target-table").addEventListener("change",updateTargetSummary);
  $("sw-next").addEventListener("click",next);
  $("sw-back").addEventListener("click",()=>setStep(Math.max(1,state.step-1)));
  $("sw-add-rule").addEventListener("click",()=>addRule());
  $("sw-save-rules").addEventListener("click",()=>saveRules().catch(e=>show(e.message,"error")));
  $("sw-confirm-rules").addEventListener("click",()=>confirmRules().catch(e=>show(e.message,"error")));
  $("sw-add-column").addEventListener("click",()=>addMapping());
  $("sw-recommend-mapping").addEventListener(
    "click",
    ()=>recommendMapping().catch(e=>show(e.message,"error"))
  );
  $("sw-save-contract").addEventListener("click",()=>saveContract().catch(e=>show(e.message,"error")));
  $("sw-confirm-quality").addEventListener("click",()=>confirmQuality().catch(e=>show(e.message,"error")));

  $("sw-generate-solution").addEventListener(
    "click",
    ()=>generateSolution().catch(
      error=>show(error.message,"error")
    )
  );

  $("sw-view-notebook").addEventListener(
    "click",
    ()=>viewArtifact("NOTEBOOK").catch(
      error=>show(error.message,"error")
    )
  );

  $("sw-view-script").addEventListener(
    "click",
    ()=>viewArtifact("PYSPARK_SCRIPT").catch(
      error=>show(error.message,"error")
    )
  );

  $("sw-view-ddl").addEventListener(
    "click",
    ()=>viewArtifact("SILVER_DDL").catch(
      error=>show(error.message,"error")
    )
  );

  $("sw-view-package").addEventListener(
    "click",
    ()=>viewArtifact("ARTIFACT_PACKAGE").catch(
      error=>show(error.message,"error")
    )
  );



  $("sw-create-execution").addEventListener("click",()=>createExecution().catch(e=>show(e.message,"error")));
  $("sw-validate-package").addEventListener("click",()=>executionAction("validate-package").catch(e=>show(e.message,"error")));
  $("sw-submit").addEventListener("click",()=>executionAction("submit").catch(e=>show(e.message,"error")));
  $("sw-sync").addEventListener("click",()=>executionAction("sync-status").catch(e=>show(e.message,"error")));

  setStep(1);
  syncJourneyButtons();
  loadConnections();
  loadTargetDatasets().catch(e=>show(e.message,"error"));
})();
