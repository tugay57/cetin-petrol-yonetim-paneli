import { supabase } from "../lib/supabase";

export async function getCustomers() {
  const { data, error } = await supabase
    .from("customers")
    .select("*")
    .order("id", { ascending: false });

  if (error) {
    console.error(error);
    return [];
  }

  return data || [];
}

export async function addCustomer(customer) {
  const { data, error } = await supabase
    .from("customers")
    .insert([customer])
    .select();

  if (error) {
    console.error(error);
    return null;
  }

  return data?.[0];
}

export async function deleteCustomer(id) {
  const { error } = await supabase
    .from("customers")
    .delete()
    .eq("id", id);

  if (error) {
    console.error(error);
  }
}

export async function getOilProducts() {
  const { data, error } = await supabase
    .from("oil_products")
    .select("*")
    .order("id", { ascending: false });

  if (error) {
    console.error(error);
    return [];
  }

  return data || [];
}

export async function addOilProduct(product) {
  const { data, error } = await supabase
    .from("oil_products")
    .insert([product])
    .select();

  if (error) {
    console.error(error);
    return null;
  }

  return data?.[0];
}

export async function deleteOilProduct(id) {
  const { error } = await supabase
    .from("oil_products")
    .delete()
    .eq("id", id);

  if (error) {
    console.error(error);
  }
}

export async function getPersonnel() {
  const { data, error } = await supabase
    .from("personnel")
    .select("*")
    .order("id", { ascending: false });

  if (error) {
    console.error(error);
    return [];
  }

  return data || [];
}

export async function addPersonnel(person) {
  const { data, error } = await supabase
    .from("personnel")
    .insert([person])
    .select();

  if (error) {
    console.error(error);
    return null;
  }

  return data?.[0];
}

export async function deletePersonnel(id) {
  const { error } = await supabase
    .from("personnel")
    .delete()
    .eq("id", id);

  if (error) {
    console.error(error);
  }
}

export async function getTransactions() {
  const { data, error } = await supabase
    .from("transactions")
    .select("*")
    .order("id", { ascending: false });

  if (error) {
    console.error(error);
    return [];
  }

  return data || [];
}

export async function addTransaction(transaction) {
  const { data, error } = await supabase
    .from("transactions")
    .insert([transaction])
    .select();

  if (error) {
    console.error(error);
    return null;
  }

  return data?.[0];
}

export async function deleteTransaction(id) {
  const { error } = await supabase
    .from("transactions")
    .delete()
    .eq("id", id);

  if (error) {
    console.error(error);
  }
}

export async function getShiftReports() {
  const { data, error } = await supabase
    .from("shift_reports")
    .select("*")
    .order("id", { ascending: false });

  if (error) {
    console.error(error);
    return [];
  }

  return data || [];
}

export async function addShiftReport(report) {
  const { data, error } = await supabase
    .from("shift_reports")
    .insert([report])
    .select();

  if (error) {
    console.error(error);
    return null;
  }

  return data?.[0];
}

export async function deleteShiftReport(id) {
  const { error } = await supabase
    .from("shift_reports")
    .delete()
    .eq("id", id);

  if (error) {
    console.error(error);
  }
}

export async function updateShiftReport(id, report) {
  const { data, error } = await supabase
    .from("shift_reports")
    .update(report)
    .eq("id", id)
    .select();

  if (error) {
    console.error(error);
    return null;
  }

  return data?.[0];
}

export async function createDailyBackup(payload) {
  const today = new Date().toISOString().slice(0, 10);

  const { error } = await supabase
    .from("daily_backups")
    .upsert(
  [
    {
      backup_date: today,
      ...payload,
    },
  ],
  { onConflict: "backup_date" }
);

  if (error) {
    console.error(error);
  }
}