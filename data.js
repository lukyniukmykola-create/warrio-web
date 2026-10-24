(() => {
  "use strict";

  const config = window.WARRIO_WEB_CONFIG || {};
  const baseUrl = String(config.supabaseUrl || "").replace(/\/$/, "");
  const apiKey = config.supabasePublishableKey;

  async function timedFetch(url, options = {}, timeoutMs = 15000) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try { return await fetch(url, { ...options, signal: controller.signal }); }
    catch (error) { if (error?.name === "AbortError") throw new Error("request_timeout"); throw error; }
    finally { clearTimeout(timer); }
  }

  function headers(extra = {}) {
    const token = window.WarrioAuth?.accessToken();
    if (!token) throw new Error("authentication_required");
    return { apikey: apiKey, Authorization: `Bearer ${token}`, ...extra };
  }

  async function request(path, options = {}) {
    const response = await timedFetch(`${baseUrl}/rest/v1/${path}`, {
      ...options,
      headers: headers(options.headers || {})
    });
    const text = await response.text();
    const payload = text ? JSON.parse(text) : null;
    if (!response.ok) {
      const error = new Error(payload?.message || payload?.hint || `Supabase HTTP ${response.status}`);
      error.status = response.status;
      error.code = payload?.code || "supabase_error";
      error.details = payload?.details || "";
      throw error;
    }
    return payload;
  }

  function query(table, parameters = {}) {
    const search = new URLSearchParams();
    for (const [key, value] of Object.entries(parameters)) {
      if (value !== undefined && value !== null && value !== "") search.set(key, String(value));
    }
    return request(`${table}?${search}`);
  }

  function rpc(name, payload) {
    return request(`rpc/${encodeURIComponent(name)}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload || {})
    });
  }

  function insert(table, row) {
    return request(table, {
      method: "POST",
      headers: { "Content-Type": "application/json", Prefer: "return=representation" },
      body: JSON.stringify(row)
    });
  }

  async function edge(name, payload) {
    const token = window.WarrioAuth?.accessToken();
    if (!token) throw new Error("authentication_required");
    const response = await timedFetch(`${baseUrl}/functions/v1/${encodeURIComponent(name)}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", apikey: apiKey, Authorization: `Bearer ${token}` },
      body: JSON.stringify(payload || {})
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) {
      const error = new Error(result.error || `Edge Function HTTP ${response.status}`);
      error.status = response.status;
      error.code = result.code || result.error || "edge_function_error";
      throw error;
    }
    return result;
  }

  async function signedDocumentUrl(bucket, path, expiresIn = 300) {
    if (!bucket || !path) throw new Error("document_missing");
    const encodedPath = String(path).split("/").map(encodeURIComponent).join("/");
    const response = await timedFetch(`${baseUrl}/storage/v1/object/sign/${encodeURIComponent(bucket)}/${encodedPath}`, {
      method: "POST",
      headers: headers({ "Content-Type": "application/json" }),
      body: JSON.stringify({ expiresIn })
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok || !result.signedURL) throw new Error(result.message || "document_download_failed");
    const signed = String(result.signedURL);
    const absolute = /^https:\/\//i.test(signed) ? signed : `${baseUrl}/storage/v1${signed}`;
    return `${absolute}${absolute.includes("?") ? "&" : "?"}download=`;
  }

  async function loadContext() {
    const session = window.WarrioAuth?.getSession();
    if (!session?.user?.id) throw new Error("authentication_required");
    const [memberships, profiles] = await Promise.all([
      query("organization_members", {
        select: "organization_id,role,is_active",
        user_id: `eq.${session.user.id}`,
        is_active: "eq.true",
        limit: 1
      }),
      query("profiles", { select: "user_id,display_name,phone", user_id: `eq.${session.user.id}`, limit: 1 })
    ]);
    const membership = memberships?.[0] || null;
    if (!membership) return { user: session.user, profile: profiles?.[0] || null, membership: null, organization: null };
    const organizations = await query("organizations", {
      select: "id,name,slug,support_email,support_phone,business_address,warranty_terms,created_at,updated_at",
      id: `eq.${membership.organization_id}`,
      limit: 1
    });
    return {
      user: session.user,
      profile: profiles?.[0] || null,
      membership,
      organization: organizations?.[0] || null
    };
  }

  async function loadWorkspace(organizationId) {
    if (!organizationId) throw new Error("organization_required");
    const orgFilter = `eq.${organizationId}`;
    const [models, products, dealers, customers, sales, warranties, installations, documents, members, audit, emailJobs, workItems] = await Promise.all([
      query("product_models", { select: "id,code,name,warranty_months,is_active", organization_id: orgFilter, order: "name.asc" }),
      query("products", { select: "id,model_id,serial_number,created_at", organization_id: orgFilter, order: "created_at.desc", limit: 500 }),
      query("dealers", { select: "id,code,name,linked_user_id,phone,email,is_active,created_at", organization_id: orgFilter, order: "name.asc", limit: 200 }),
      query("customers", { select: "id,full_name,phone,email,installation_address,created_at", organization_id: orgFilter, order: "created_at.desc", limit: 500 }),
      query("sales", { select: "id,product_id,dealer_id,dealer_name_snapshot,sale_date,created_at", organization_id: orgFilter, order: "sale_date.desc", limit: 500 }),
      query("warranties", { select: "id,sale_id,customer_id,warranty_number,status,activated_at,expires_on,created_at", organization_id: orgFilter, order: "created_at.desc", limit: 500 }),
      query("installations", { select: "id,warranty_id,installed_on,installer_name_snapshot,comment,created_at", organization_id: orgFilter, order: "installed_on.desc", limit: 500 }),
      query("warranty_documents", { select: "id,warranty_id,storage_path,google_file_id,public_verification_url,generated_at", organization_id: orgFilter, order: "generated_at.desc", limit: 500 }),
      query("organization_members", { select: "organization_id,user_id,role,is_active,created_at", organization_id: orgFilter, order: "created_at.asc", limit: 200 }),
      query("audit_events", { select: "id,event_type,entity_type,entity_id,metadata,created_at", organization_id: orgFilter, order: "created_at.desc", limit: 50 })
      ,query("email_jobs", { select: "id,warranty_id,status,delivery_status,delivery_event_at,delivery_error,attempts,last_error_code,provider,provider_message_id,scheduled_at,sent_at,updated_at", organization_id: orgFilter, order: "created_at.desc", limit: 200 })
      ,query("work_items", { select: "id,title,description,item_type,status,priority,due_at,sale_id,warranty_id,assigned_user_id,created_by,completed_at,created_at,updated_at", organization_id: orgFilter, order: "due_at.asc.nullslast,created_at.desc", limit: 500 })
    ]);

    const modelById = new Map(models.map(item => [item.id, item]));
    const productById = new Map(products.map(item => [item.id, { ...item, model: modelById.get(item.model_id) || null }]));
    const dealerById = new Map(dealers.map(item => [item.id, item]));
    const customerById = new Map(customers.map(item => [item.id, item]));
    const saleById = new Map(sales.map(item => [item.id, { ...item, product: productById.get(item.product_id) || null, dealer: dealerById.get(item.dealer_id) || null }]));
    const installationByWarranty = new Map(installations.map(item => [item.warranty_id, item]));
    const documentByWarranty = new Map(documents.map(item => [item.warranty_id, item]));
    const enrichedWarranties = warranties.map(item => ({
      ...item,
      sale: saleById.get(item.sale_id) || null,
      customer: customerById.get(item.customer_id) || null,
      installation: installationByWarranty.get(item.id) || null,
      document: documentByWarranty.get(item.id) || null
    }));

    return {
      models, products, dealers, customers, sales: [...saleById.values()],
      warranties: enrichedWarranties, installations, documents, members, audit, emailJobs, workItems,
      metrics: {
        sales: sales.length,
        activeWarranties: warranties.filter(item => String(item.status).startsWith("active_")).length,
        pendingActivation: Math.max(0, sales.length - warranties.length),
        installed: installations.length,
        failedEmails: emailJobs.filter(item => item.status === "failed" || ["bounced", "complained", "failed"].includes(item.delivery_status)).length,
        openWorkItems: workItems.filter(item => ["open", "in_progress"].includes(item.status)).length,
        overdueWorkItems: workItems.filter(item => ["open", "in_progress"].includes(item.status) && item.due_at && Date.parse(item.due_at) < Date.now()).length
      }
    };
  }

  function createOrganization(name, slug) {
    return rpc("create_warrio_organization", { org_name: name, org_slug: slug });
  }

  function registerSale(input) {
    return rpc("register_warrio_sale", {
      p_organization_id: input.organizationId,
      p_serial_number: input.serialNumber,
      p_model_code: input.modelCode,
      p_dealer_id: input.dealerId || null,
      p_dealer_name: input.dealerName || "Warrio",
      p_sale_date: input.saleDate
    });
  }

  function issueActivationToken(input) {
    return rpc("issue_warrio_activation_token", {
      p_organization_id: input.organizationId,
      p_sale_id: input.saleId
    });
  }

  function activateWarranty(input) {
    return rpc("activate_warrio_warranty", {
      p_organization_id: input.organizationId,
      p_serial_number: input.serialNumber,
      p_customer_name: input.customerName,
      p_customer_phone: input.customerPhone,
      p_customer_email: input.customerEmail,
      p_installation_address: input.installationAddress
    });
  }

  function confirmInstallation(input) {
    return rpc("confirm_warrio_installation", {
      p_organization_id: input.organizationId,
      p_serial_number: input.serialNumber,
      p_installed_on: input.installedOn,
      p_installer_name: input.installerName,
      p_comment: input.comment || ""
    });
  }

  function inviteMember(input) {
    return edge("invite-member", {
      organizationId: input.organizationId,
      email: input.email,
      fullName: input.fullName,
      role: input.role,
      dealerId: input.dealerId || undefined,
      redirectTo: input.redirectTo
    });
  }

  function sendWarrantyEmail(input) {
    return edge("send-warranty-email", {
      warrantyId: input.warrantyId,
      publicToken: input.publicToken
    });
  }

  function createWorkItem(input) {
    return rpc("create_warrio_work_item", {
      p_organization_id: input.organizationId,
      p_title: input.title,
      p_description: input.description || "",
      p_item_type: input.itemType || "follow_up",
      p_priority: input.priority || "normal",
      p_due_at: input.dueAt || null,
      p_sale_id: input.saleId || null,
      p_warranty_id: input.warrantyId || null,
      p_assigned_user_id: input.assignedUserId || null
    });
  }

  function updateWorkItemStatus(workItemId, status) {
    return rpc("update_warrio_work_item_status", {
      p_work_item_id: workItemId,
      p_status: status
    });
  }

  function createDealer(input) {
    return insert("dealers", {
      organization_id: input.organizationId,
      code: input.code || null,
      name: input.name,
      phone: input.phone || null,
      email: input.email || null,
      is_active: true
    });
  }

  function updateOrganizationSettings(input) {
    return rpc("update_warrio_organization_settings", {
      p_organization_id: input.organizationId,
      p_name: input.name,
      p_support_email: input.supportEmail || null,
      p_support_phone: input.supportPhone || null,
      p_business_address: input.businessAddress || null,
      p_warranty_terms: input.warrantyTerms || null
    });
  }

  function updateModelWarranty(input) {
    return rpc("update_warrio_model_warranty", {
      p_organization_id: input.organizationId,
      p_model_id: input.modelId,
      p_warranty_months: input.warrantyMonths
    });
  }

  window.WarrioData = Object.freeze({
    request, query, insert, rpc, edge, signedDocumentUrl, loadContext, loadWorkspace, createOrganization,
    registerSale, issueActivationToken, activateWarranty, confirmInstallation,
    inviteMember, sendWarrantyEmail, createWorkItem, updateWorkItemStatus, createDealer,
    updateOrganizationSettings, updateModelWarranty
  });
})();
