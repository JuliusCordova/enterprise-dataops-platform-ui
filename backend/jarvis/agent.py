from functools import cached_property
from google.adk.agents import LlmAgent
from google.adk.models import Gemini
from google.genai import Client
from google.adk.tools import agent_tool
from google.adk.tools.google_search_tool import GoogleSearchTool
from google.adk.tools import url_context
from google.cloud import bigquery
from google.adk.tools import FunctionTool
from datetime import datetime
import uuid
import json
from google import genai



class GlobalGemini(Gemini):
  """Pins the Vertex AI client to the `global` location.

  gemini-3 series models are only served from `global`; the default ADK
  `Gemini` integration constructs a `google.genai.Client` whose location
  defaults to the AgentEngine instance's region (e.g. `us-central1`) and
  fails with model-not-found for these models. Subclassing per the override
  pattern documented on `google.adk.models.google_llm.Gemini` lets the agent
  keep running in its regional AgentEngine instance while routing the model
  request to the global endpoint.
  """

  @cached_property
  def api_client(self) -> Client:
    return Client(vertexai=True, location="global")


intercorp_decision_agent_google_search_agent = LlmAgent(
  name='Intercorp_Decision_Agent_google_search_agent',
  model=GlobalGemini(model='gemini-3.5-flash'),
  description=(
      'Agent specialized in performing Google searches.'
  ),
  sub_agents=[],
  instruction='Use the GoogleSearchTool to find information on the web.',
  tools=[
    GoogleSearchTool()
  ],
)
intercorp_decision_agent_url_context_agent = LlmAgent(
  name='Intercorp_Decision_Agent_url_context_agent',
  model=GlobalGemini(model='gemini-3.5-flash'),
  description=(
      'Agent specialized in fetching content from URLs.'
  ),
  sub_agents=[],
  instruction='Use the UrlContextTool to retrieve content from provided URLs.',
  tools=[
    url_context
  ],
)

PROJECT_ID = "proyectopersonal-480420"
DATASET = "demo_semantic"

bq_client = bigquery.Client(project=PROJECT_ID)


def get_inventory_risk(zone: str = "Lima Norte"):
  """
  Consulta riesgos de quiebre de stock por zona comercial desde BigQuery.
  """
  sql = f"""
  SELECT
    store_name,
    commercial_zone,
    product_name,
    department,
    category,
    inventory_status,
    days_of_cover,
    stockout_risk_flag,
    inventory_value_pen
  FROM `{PROJECT_ID}.{DATASET}.vw_inventory_risk`
  WHERE commercial_zone = @zone
    AND stockout_risk_flag = TRUE
  ORDER BY days_of_cover ASC
  LIMIT 10
  """

  job_config = bigquery.QueryJobConfig(
      query_parameters=[
          bigquery.ScalarQueryParameter("zone", "STRING", zone)
      ]
  )

  rows = bq_client.query(sql, job_config=job_config).result()
  return [dict(row) for row in rows]

def get_demand_forecast(zone: str = "Lima Norte", campaign_id: str = "CAMP009"):
  """
  Consulta forecast de demanda por zona y campaña desde BigQuery.
  """
  sql = f"""
  SELECT
    store_name,
    commercial_zone,
    product_name,
    predicted_demand_units,
    uplift_pct,
    stockout_risk_score,
    recommended_order_units,
    forecast_status,
    confidence_score
  FROM `{PROJECT_ID}.{DATASET}.vw_demand_forecast`
  WHERE commercial_zone = @zone
    AND campaign_id = @campaign_id
  ORDER BY stockout_risk_score DESC
  LIMIT 10
  """

  job_config = bigquery.QueryJobConfig(
      query_parameters=[
          bigquery.ScalarQueryParameter("zone", "STRING", zone),
          bigquery.ScalarQueryParameter("campaign_id", "STRING", campaign_id)
      ]
  )

  rows = bq_client.query(sql, job_config=job_config).result()
  return [dict(row) for row in rows]

def get_recommendations(zone: str = "Lima Norte", campaign_id: str = "CAMP009"):
  """
  Consulta recomendaciones ejecutivas de abastecimiento desde BigQuery.
  """
  sql = f"""
  SELECT
    store_name,
    product_name,
    scenario_type,
    recommended_action,
    supplier_name,
    average_lead_time_days,
    expected_loss_avoidance_pen,
    expected_roi_pct,
    confidence_score,
    executive_summary
  FROM `{PROJECT_ID}.{DATASET}.vw_recommendation_scenarios`
  WHERE commercial_zone = @zone
    AND campaign_id = @campaign_id
    AND recommended_flag = TRUE
  ORDER BY expected_loss_avoidance_pen DESC
  LIMIT 10
  """

  job_config = bigquery.QueryJobConfig(
      query_parameters=[
          bigquery.ScalarQueryParameter("zone", "STRING", zone),
          bigquery.ScalarQueryParameter("campaign_id", "STRING", campaign_id)
      ]
  )

  rows = bq_client.query(sql, job_config=job_config).result()
  return [dict(row) for row in rows]

def get_executive_kpis(campaign_id: str = "CAMP009"):
  """
  Consulta KPIs ejecutivos por campaña desde BigQuery.
  """
  sql = f"""
  SELECT
    campaign_id,
    campaign_name,
    commercial_zone,
    region,
    total_transactions,
    total_units_sold,
    total_sales_pen,
    total_margin_pen,
    lost_sales_estimate_pen,
    margin_pct
  FROM `{PROJECT_ID}.{DATASET}.vw_executive_kpis`
  WHERE campaign_id = @campaign_id
  ORDER BY total_sales_pen DESC
  LIMIT 20
  """

  job_config = bigquery.QueryJobConfig(
      query_parameters=[
          bigquery.ScalarQueryParameter("campaign_id", "STRING", campaign_id)
      ]
  )

  rows = bq_client.query(sql, job_config=job_config).result()
  return [dict(row) for row in rows]

def get_agentops_metrics():
  """
  Consulta métricas de observabilidad de agentes desde BigQuery.
  """
  sql = f"""
  SELECT
    agent_name,
    event_type,
    status,
    COUNT(*) AS total_events,
    AVG(execution_time_ms) AS avg_execution_time_ms,
    SUM(tokens_input) AS total_tokens_input,
    SUM(tokens_output) AS total_tokens_output
  FROM `{PROJECT_ID}.{DATASET}.vw_agentops`
  GROUP BY
    agent_name,
    event_type,
    status
  ORDER BY total_events DESC
  LIMIT 30
  """

  rows = bq_client.query(sql).result()
  return [dict(row) for row in rows]  

def create_action_request(
    action_type: str,
    store_name: str,
    product_name: str,
    justification: str,
    priority: str = "HIGH"
):
  """
  Genera una solicitud simulada de acción operativa para revisión ejecutiva.
  No ejecuta acciones reales en sistemas transaccionales.
  """

  request_id = f"REQ-{uuid.uuid4().hex[:8].upper()}"

  return {
      "request_id": request_id,
      "status": "PENDING_REVIEW",
      "action_type": action_type,
      "store_name": store_name,
      "product_name": product_name,
      "priority": priority,
      "justification": justification,
      "created_at": datetime.utcnow().isoformat(),
      "message": (
          "Solicitud simulada creada para revisión. "
          "No se ejecutó ninguna acción real en sistemas transaccionales."
      )
  }

root_agent = LlmAgent(
  name='Intercorp_Decision_Agent',
  model=GlobalGemini(model='gemini-3.5-flash'),
  description=(
      'Agente de apoyo para decisiones operativas y comerciales durante FEST 2026.'
  ),
  sub_agents=[],
  instruction='Eres JARVIS, el framework de agente ejecutivo para Intercorp FEST 2026.\n\nTu rol es actuar como un copiloto estratégico de decisiones para operaciones retail, usando un enfoque estructurado, ejecutivo y accionable.\n\nNombre operativo:\nJARVIS Decision Framework\n\nSignificado funcional de JARVIS:\nJ - Justificar el problema con evidencia de datos.\nA - Analizar impacto operativo, comercial y financiero.\nR - Recomendar alternativas priorizadas.\nV - Validar riesgos, supuestos y confianza de la recomendación.\nI - Integrar datos, agentes, dashboards y APIs empresariales.\nS - Sintetizar una decisión ejecutiva clara.\n\nContexto de negocio:\nLa campaña principal es FEST 2026.\nEl caso crítico es un posible quiebre de stock en Lima Norte para SKUs críticos y productos de campaña.\nLa pérdida potencial estimada puede llegar a S/420K si no se toman acciones oportunas.\n\nTu responsabilidad:\nAyudar a gerentes y ejecutivos a tomar decisiones sobre:\n- Ventas\n- Inventario\n- Forecast de demanda\n- Campañas comerciales\n- Riesgo de quiebre de stock\n- Recomendaciones de abastecimiento\n- Proveedores alternativos\n- Simulación de escenarios\n- Observabilidad de agentes\n\nEstilo de respuesta:\n- Ejecutivo\n- Claro\n- Breve\n- Orientado a decisiones\n- Basado en evidencia\n- Sin tecnicismos innecesarios\n\nCuando recibas una pregunta:\n1. Identifica la intención del usuario.\n2. Usa el enfoque JARVIS.\n3. Si existe riesgo, cuantifica impacto.\n4. Si existen alternativas, prioriza por ROI, pérdida evitada, tiempo de implementación y confianza.\n5. Si falta información, indícalo de forma clara.\n6. Nunca inventes métricas; usa los datos disponibles o declara que se requiere consultar la fuente.\n\nFormato preferido de respuesta:\n\nResumen Ejecutivo:\n[Una síntesis clara del hallazgo principal.]\n\nEvidencia:\n[Datos relevantes: zona, tienda, producto, campaña, demanda, inventario, riesgo.]\n\nImpacto:\n[Impacto financiero, operativo o comercial.]\n\nRecomendación:\n[Acción priorizada.]\n\nSiguiente paso:\n[Qué debería hacer el usuario.]\n\nReglas:\n- Si el usuario pregunta por FEST 2026, prioriza la campaña CAMP009.\n- Si el usuario pregunta por riesgo operativo, evalúa inventario, forecast y recomendaciones.\n- Si el usuario pregunta por Lima Norte, prioriza tiendas y productos críticos de esa zona.\n- Si el usuario pide una recomendación, entrega máximo 3 alternativas.\n- Si el usuario pide una decisión ejecutiva, da una recomendación única y justificada.\n- Si hay una pérdida evitada o ROI disponible, inclúyelo.\n- Si hay confianza de recomendación disponible, inclúyela.\n- Si el usuario pregunta por agentes, utiliza la información de observabilidad AgentOps.\n\nMensaje de posicionamiento:\nNo eres un chatbot. Eres un copiloto ejecutivo que convierte señales de negocio en decisiones accionables. Cuando el usuario autorice o pida proceder con una recomendación, no indiques que ejecutaste una acción real. Usa la tool create_action_request para generar una solicitud simulada de revisión ejecutiva. La respuesta debe indicar claramente que la solicitud queda en estado PENDING_REVIEW.',
  tools=[
  FunctionTool(func=get_inventory_risk),
  FunctionTool(func=get_demand_forecast),
  FunctionTool(func=get_recommendations),
  FunctionTool(func=get_executive_kpis),
  FunctionTool(func=get_agentops_metrics),
  FunctionTool(func=create_action_request),
  agent_tool.AgentTool(agent=intercorp_decision_agent_google_search_agent),
  agent_tool.AgentTool(agent=intercorp_decision_agent_url_context_agent)
  ],
)
