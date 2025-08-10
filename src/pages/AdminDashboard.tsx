import React, { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { toast } from "sonner";
import { Download, Filter, RefreshCcw, Search, CheckCircle2, XCircle, MoreHorizontal, Eye } from "lucide-react";

// Types matching the DB
export type ApplicationStatus = "pending" | "in_review" | "approved" | "rejected";

export type Application = {
  id: string;
  user_id: string | null;
  applicant_name: string | null;
  email: string | null;
  phone: string | null;
  status: ApplicationStatus;
  payload: Record<string, any>;
  submitted_at: string;
  updated_at: string;
};

const statusColors: Record<ApplicationStatus, string> = {
  pending: "bg-muted text-foreground",
  in_review: "bg-secondary text-secondary-foreground",
  approved: "bg-primary text-primary-foreground",
  rejected: "bg-destructive text-destructive-foreground",
};

const statusOptions: ApplicationStatus[] = ["pending", "in_review", "approved", "rejected"];

type Sort = { field: "submitted_at" | "applicant_name" | "email"; dir: "asc" | "desc" };

const fetchApplications = async (
  search: string,
  status: ApplicationStatus | "all",
  sort: Sort
) => {
  let query = supabase
    .from("onboarding_applications")
    .select("id,user_id,applicant_name,email,phone,status,payload,submitted_at,updated_at");

  if (status !== "all") {
    query = query.eq("status", status);
  }
  if (search) {
    // Search by name or email
    query = query.or(
      `applicant_name.ilike.%${search}%,email.ilike.%${search}%`
    );
  }

  // Sorting
  query = query.order(sort.field, { ascending: sort.dir === "asc" });

  const { data, error } = await query;
  if (error) throw error;
  return (data || []) as Application[];
};

export default function AdminDashboard() {
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<ApplicationStatus | "all">("all");
  const [sort, setSort] = useState<Sort>({ field: "submitted_at", dir: "desc" });
  const [selected, setSelected] = useState<Record<string, boolean>>({});

  const queryClient = useQueryClient();

  useEffect(() => {
    document.title = "Admin • Onboarding Applications";
  }, []);

  const { data, isLoading, refetch, isFetching } = useQuery({
    queryKey: ["applications", { search, status, sort }],
    queryFn: () => fetchApplications(search, status, sort),
  });

  // Realtime updates: invalidate list on inserts/updates/deletes
  useEffect(() => {
    const channel = supabase
      .channel("onboarding_applications_changes")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "onboarding_applications" },
        () => {
          queryClient.invalidateQueries({ queryKey: ["applications"] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient]);

  const allSelected = useMemo(() => {
    const ids = (data || []).map((a) => a.id);
    return ids.length > 0 && ids.every((id) => selected[id]);
  }, [data, selected]);

  const toggleSelectAll = (checked: boolean) => {
    const next: Record<string, boolean> = {};
    (data || []).forEach((a) => (next[a.id] = checked));
    setSelected(next);
  };

  const selectedIds = useMemo(() => Object.keys(selected).filter((k) => selected[k]), [selected]);

  const bulkUpdateStatus = async (newStatus: ApplicationStatus) => {
    if (selectedIds.length === 0) return;
    const { error } = await supabase
      .from("onboarding_applications")
      .update({ status: newStatus })
      .in("id", selectedIds);
    if (error) {
      toast.error(`Failed to update: ${error.message}`);
    } else {
      toast.success(`Updated ${selectedIds.length} application(s) to ${newStatus}`);
      setSelected({});
      refetch();
    }
  };

  const exportCSV = () => {
    const rows = (data || []).map((a) => ({
      id: a.id,
      applicant_name: a.applicant_name ?? "",
      email: a.email ?? "",
      phone: a.phone ?? "",
      status: a.status,
      submitted_at: a.submitted_at,
    }));
    const header = Object.keys(rows[0] || { id: "", applicant_name: "", email: "", phone: "", status: "", submitted_at: "" });
    const csv = [
      header.join(","),
      ...rows.map((r) => header.map((h) => `${String((r as any)[h]).replaceAll('"', '""')}`).join(",")),
    ].join("\n");

    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `applications_${new Date().toISOString().slice(0, 19)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const toggleSort = (field: Sort["field"]) => {
    setSort((s) => ({ field, dir: s.field === field && s.dir === "desc" ? "asc" : "desc" }));
  };

  return (
    <main className="container mx-auto px-4 py-6">
      <header className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-heading">Onboarding Applications</h1>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => refetch()} aria-label="Refresh" className="gap-2">
            <RefreshCcw className="h-4 w-4" /> Refresh
          </Button>
          <Button variant="outline" onClick={exportCSV} aria-label="Export CSV" className="gap-2">
            <Download className="h-4 w-4" /> Export CSV
          </Button>
        </div>
      </header>

      {/* Controls */}
      <section className="mb-4 grid grid-cols-1 gap-3 md:grid-cols-3">
        <div className="flex items-center gap-2">
          <Search className="h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search name or email"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            aria-label="Search applications"
          />
        </div>
        <div className="flex items-center gap-2">
          <Filter className="h-4 w-4 text-muted-foreground" />
          <Select value={status} onValueChange={(v) => setStatus(v as any)}>
            <SelectTrigger aria-label="Filter by status">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              {statusOptions.map((s) => (
                <SelectItem key={s} value={s} className="capitalize">
                  {s.replace("_", " ")}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex items-center justify-start md:justify-end gap-2">
          <Button variant="outline" size="sm" disabled={selectedIds.length === 0} onClick={() => bulkUpdateStatus("approved")} className="gap-2">
            <CheckCircle2 className="h-4 w-4" /> Approve
          </Button>
          <Button variant="outline" size="sm" disabled={selectedIds.length === 0} onClick={() => bulkUpdateStatus("rejected")} className="gap-2">
            <XCircle className="h-4 w-4" /> Reject
          </Button>
          <Button variant="outline" size="sm" disabled={selectedIds.length === 0} onClick={() => bulkUpdateStatus("in_review")} className="gap-2">
            <MoreHorizontal className="h-4 w-4" /> In Review
          </Button>
        </div>
      </section>

      {/* Table */}
      <section className="rounded-lg border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-12">
                <Checkbox checked={allSelected} onCheckedChange={(c) => toggleSelectAll(Boolean(c))} aria-label="Select all" />
              </TableHead>
              <TableHead onClick={() => toggleSort("applicant_name")} className="cursor-pointer select-none">Name</TableHead>
              <TableHead onClick={() => toggleSort("email")} className="cursor-pointer select-none">Email</TableHead>
              <TableHead>Status</TableHead>
              <TableHead onClick={() => toggleSort("submitted_at")} className="cursor-pointer select-none">Submitted</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                  Loading...
                </TableCell>
              </TableRow>
            ) : (data || []).length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                  No applications found
                </TableCell>
              </TableRow>
            ) : (
              (data || []).map((a) => (
                <TableRow key={a.id} className="hover:bg-muted/50">
                  <TableCell>
                    <Checkbox
                      checked={!!selected[a.id]}
                      onCheckedChange={(c) => setSelected((prev) => ({ ...prev, [a.id]: Boolean(c) }))}
                      aria-label={`Select application ${a.id}`}
                    />
                  </TableCell>
                  <TableCell className="font-medium">{a.applicant_name || "—"}</TableCell>
                  <TableCell>{a.email || "—"}</TableCell>
                  <TableCell>
                    <Badge className={`${statusColors[a.status]} capitalize`}>{a.status.replace("_", " ")}</Badge>
                  </TableCell>
                  <TableCell>{new Date(a.submitted_at).toLocaleString()}</TableCell>
                  <TableCell className="text-right">
                    <Dialog>
                      <DialogTrigger asChild>
                        <Button variant="ghost" size="sm" className="gap-2">
                          <Eye className="h-4 w-4" /> View
                        </Button>
                      </DialogTrigger>
                      <DialogContent className="max-w-3xl">
                        <DialogHeader>
                          <DialogTitle className="font-heading">Application Details</DialogTitle>
                        </DialogHeader>
                        <div className="grid gap-3">
                          <div className="grid grid-cols-2 gap-3">
                            <div>
                              <div className="text-sm text-muted-foreground">Name</div>
                              <div className="font-medium">{a.applicant_name || "—"}</div>
                            </div>
                            <div>
                              <div className="text-sm text-muted-foreground">Email</div>
                              <div className="font-medium">{a.email || "—"}</div>
                            </div>
                            <div>
                              <div className="text-sm text-muted-foreground">Phone</div>
                              <div className="font-medium">{a.phone || "—"}</div>
                            </div>
                            <div>
                              <div className="text-sm text-muted-foreground">Status</div>
                              <div>
                                <Badge className={`${statusColors[a.status]} capitalize`}>{a.status.replace("_", " ")}</Badge>
                              </div>
                            </div>
                          </div>
                          <div>
                            <div className="mb-1 text-sm text-muted-foreground">Submitted</div>
                            <div className="font-medium">{new Date(a.submitted_at).toLocaleString()}</div>
                          </div>
                          <div className="mt-4">
                            <div className="mb-2 font-medium">Form Data</div>
                            <pre className="max-h-80 overflow-auto rounded-md bg-muted p-3 text-xs">
{JSON.stringify(a.payload, null, 2)}
                            </pre>
                          </div>
                          <div className="mt-2 flex flex-wrap gap-2">
                            {statusOptions.map((s) => (
                              <Button key={s} variant="outline" size="sm" onClick={() => bulkUpdateStatus(s)} className="capitalize">
                                Set {s.replace("_", " ")}
                              </Button>
                            ))}
                          </div>
                        </div>
                      </DialogContent>
                    </Dialog>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </section>

      {isFetching && (
        <div className="mt-2 text-xs text-muted-foreground">Updating…</div>
      )}
    </main>
  );
}
