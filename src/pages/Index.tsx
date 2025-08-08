import { useEffect, useMemo, useState } from "react";
import { useForm, FormProvider, SubmitHandler } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { toast } from "@/hooks/use-toast";

// Provinces list for South Africa
const PROVINCES = [
  "Eastern Cape",
  "Free State",
  "Gauteng",
  "KwaZulu-Natal",
  "Limpopo",
  "Mpumalanga",
  "North West",
  "Northern Cape",
  "Western Cape",
];

const PHONE_REGEX = /^(?:\+27|0)[1-9][0-9]{8}$/;

const eligibilitySchema = z.object({
  ownsVehicle: z.boolean({ required_error: "Please confirm if you own a vehicle" }),
  eligibilityCapacityTons: z
    .number({ invalid_type_error: "Enter capacity in tons" })
    .min(0, "Enter capacity in tons"),
  hasRequiredDocs: z.boolean(),
});

const formSchema = z
  .object({
    // Eligibility
    ownsVehicle: z.boolean(),
    eligibilityCapacityTons: z.number(),
    hasRequiredDocs: z.boolean(),

    // Step 1: Basic Info
    fullName: z.string().min(2, "Enter full name"),
    idNumber: z.string().min(5, "Enter ID or Passport number"),
    entityType: z.enum(["individual", "business"], {
      required_error: "Select an entity type",
    }),
    businessName: z.string().optional(),
    mobile: z.string().regex(PHONE_REGEX, "Enter a valid South African number"),
    email: z.string().email("Enter a valid email"),
    address: z.string().min(5, "Enter a physical address"),
    province: z.string().min(2, "Select a province or region"),

    // Step 2: Vehicle Info
    numberOfTrucks: z.number().int().min(1, "Must be at least 1"),
    vehicleType: z.string().min(2, "Select a vehicle type"),
    loadCapacity: z.number().min(1, "Min 1T").max(15, "Max 15T"),
    registrationNumber: z.string().min(3, "Enter registration number"),
    proofOfOwnership: z.any(),
    roadworthyCert: z.any(),
    insuranceCert: z.any(),
    vehiclePhoto: z.any().optional(),

    // Step 3: Banking
    bankName: z.string().min(2, "Enter bank name"),
    accountHolder: z.string().min(2, "Enter account holder name"),
    accountNumber: z.string().regex(/^\d{8,13}$/, "8–13 digits"),
    accountType: z.enum(["cheque", "savings", "business"], {
      required_error: "Select account type",
    }),
    branchCode: z.string().regex(/^\d{6}$/, "6 digits"),
    proofOfBank: z.any(),

    // Step 4: Terms
    acceptTerms: z.boolean().refine((v) => v === true, {
      message: "You must accept the Terms of Use",
    }),
    consentStore: z.boolean().refine((v) => v === true, {
      message: "You must consent to data storage",
    }),
    consentContact: z.boolean().refine((v) => v === true, {
      message: "You must consent to be contacted",
    }),
  })
  .refine((data) => {
    if (data.entityType === "business") {
      return !!data.businessName && data.businessName.length > 1;
    }
    return true;
  }, {
    message: "Enter business name",
    path: ["businessName"],
  })
  .refine((data) => data.eligibilityCapacityTons >= 1 && data.eligibilityCapacityTons <= 15, {
    message: "Capacity must be between 1T and 15T",
    path: ["eligibilityCapacityTons"],
  });

type FormValues = z.infer<typeof formSchema>;

const defaultValues: FormValues = {
  // eligibility
  ownsVehicle: false,
  eligibilityCapacityTons: 0,
  hasRequiredDocs: false,
  // step 1
  fullName: "",
  idNumber: "",
  entityType: "individual",
  businessName: "",
  mobile: "",
  email: "",
  address: "",
  province: "",
  // step 2
  numberOfTrucks: 1,
  vehicleType: "",
  loadCapacity: 1,
  registrationNumber: "",
  proofOfOwnership: undefined,
  roadworthyCert: undefined,
  insuranceCert: undefined,
  vehiclePhoto: undefined,
  // step 3
  bankName: "",
  accountHolder: "",
  accountNumber: "",
  accountType: undefined as any,
  branchCode: "",
  proofOfBank: undefined,
  // step 4
  acceptTerms: false,
  consentStore: false,
  consentContact: false,
};

const steps = [
  { key: "eligibility", title: "Eligibility Check", desc: "Confirm basic requirements" },
  { key: "basic", title: "Basic Info", desc: "Your contact & entity details" },
  { key: "vehicle", title: "Vehicle Info", desc: "Fleet & compliance documents" },
  { key: "banking", title: "Banking Info", desc: "Payment details" },
  { key: "terms", title: "Terms & Consent", desc: "Agreements & privacy" },
];

function Stepper({ current }: { current: number }) {
  return (
    <ol className="flex items-center justify-center gap-8 mb-8">
      {steps.map((s, i) => {
        const active = i === current;
        const done = i < current;
        return (
          <li key={s.key} className="flex items-center gap-3" aria-current={active ? "step" : undefined}>
            <span
              className={[
                "inline-flex h-8 w-8 items-center justify-center rounded-full border",
                done ? "bg-primary text-primary-foreground border-primary" : active ? "border-primary text-primary" : "border-muted-foreground/30 text-muted-foreground",
              ].join(" ")}
            >
              {done ? "✓" : i + 1}
            </span>
            <div className="hidden sm:block">
              <div className="text-sm font-medium">{s.title}</div>
              <div className="text-xs text-muted-foreground">{s.desc}</div>
            </div>
          </li>
        );
      })}
    </ol>
  );
}

function Section({ title, description, children }: { title: string; description?: string; children: React.ReactNode }) {
  return (
    <section className="space-y-6">
      <header className="space-y-1">
        <h2 className="text-2xl font-semibold tracking-tight">{title}</h2>
        {description && (
          <p className="text-sm text-muted-foreground mt-1">{description}</p>
        )}
      </header>
      <div className="grid gap-6 sm:grid-cols-2">{children}</div>
    </section>
  );
}

function FileField({ name, label, accept, required }: { name: keyof FormValues; label: string; accept?: string; required?: boolean }) {
  return (
    <FormField
      name={name as any}
      render={({ field, fieldState }) => (
        <FormItem>
          <FormLabel>{label}</FormLabel>
          <FormControl>
            <Input
              type="file"
              accept={accept}
              onChange={(e) => {
                const file = e.target.files?.[0];
                field.onChange(file);
              }}
            />
          </FormControl>
          {fieldState.error && <FormMessage />}
        </FormItem>
      )}
    />
  );
}

const Index = () => {
  const [step, setStep] = useState(0);
  const methods = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues,
    mode: "onChange",
  });
  const { control, handleSubmit, trigger, watch, setValue } = methods;

  useEffect(() => {
    document.title = "Hauler Onboarding – Premium Red Flow";
    const desc = "Professional hauler onboarding with eligibility checks, vehicle and banking verification.";
    const meta = document.querySelector('meta[name="description"]');
    if (meta) meta.setAttribute("content", desc);
    else {
      const m = document.createElement("meta");
      m.name = "description";
      m.content = desc;
      document.head.appendChild(m);
    }
    // Canonical
    let link = document.querySelector('link[rel="canonical"]');
    if (!link) {
      link = document.createElement("link");
      link.setAttribute("rel", "canonical");
      document.head.appendChild(link);
    }
    link.setAttribute("href", window.location.origin + "/");

    // Structured data (HowTo)
    const howTo = {
      '@context': 'https://schema.org/',
      '@type': 'HowTo',
      name: 'Hauler Onboarding Flow',
      description: desc,
      step: steps.map((s, i) => ({ '@type': 'HowToStep', position: i + 1, name: s.title, text: s.desc })),
    };
    const existing = document.getElementById('jsonld-howto') as HTMLScriptElement | null;
    const script = existing || (document.createElement('script') as HTMLScriptElement);
    script.id = 'jsonld-howto';
    script.type = 'application/ld+json';
    script.textContent = JSON.stringify(howTo);
    if (!existing) document.head.appendChild(script);
  }, []);

  const entityType = watch("entityType");
  const ownsVehicle = watch("ownsVehicle");
  const eligCap = watch("eligibilityCapacityTons");
  const hasDocs = watch("hasRequiredDocs");

  const eligibilityStatus = useMemo(() => {
    if (!ownsVehicle) return { ok: false, reason: "Reject: Driver only not allowed" };
    if (!(eligCap >= 1 && eligCap <= 15)) return { ok: false, reason: "Reject: Invalid truck size" };
    if (!hasDocs) return { ok: false, reason: "Reject: Missing ownership or roadworthy or insurance" };
    return { ok: true } as const;
  }, [ownsVehicle, eligCap, hasDocs]);

  const goNext = async () => {
    const fieldsByStep: (keyof FormValues)[][] = [
      ["ownsVehicle", "eligibilityCapacityTons", "hasRequiredDocs"],
      ["fullName", "idNumber", "entityType", "businessName", "mobile", "email", "address", "province"],
      ["numberOfTrucks", "vehicleType", "loadCapacity", "registrationNumber", "proofOfOwnership", "roadworthyCert", "insuranceCert", "vehiclePhoto"],
      ["bankName", "accountHolder", "accountNumber", "accountType", "branchCode", "proofOfBank"],
      ["acceptTerms", "consentStore", "consentContact"],
    ];
    const valid = await trigger(fieldsByStep[step] as any, { shouldFocus: true });
    if (!valid) return;
    if (step === 0 && !eligibilityStatus.ok) return; // gate
    setStep((s) => Math.min(s + 1, steps.length - 1));
  };

  const goBack = () => setStep((s) => Math.max(0, s - 1));

  const onSubmit: SubmitHandler<FormValues> = async (data) => {
    // In a future iteration we can persist to Supabase
    console.log("Onboarding submitted", data);
    toast({ title: "Submitted", description: "Thank you. We will review and contact you." });
    setStep(steps.length - 1);
  };

  return (
    <main className="min-h-screen relative">
      {/* Signature ambient gradient */}
      <div className="pointer-events-none absolute inset-0" style={{ background: "var(--gradient-brand)" }} />

      <div className="container mx-auto px-4 py-10 md:py-16">
        <h1 className="sr-only">Hauler Onboarding Flow</h1>
        <div className="mx-auto max-w-3xl">
          <Card className="relative border bg-card shadow-[var(--shadow-elevated)]">
            <CardHeader className="space-y-2">
              <CardTitle className="text-2xl">Hauler Onboarding</CardTitle>
              <CardDescription>Minimal, human‑centred flow. Lots of clarity, no clutter.</CardDescription>
              <Stepper current={step} />
            </CardHeader>
            <CardContent>
              <FormProvider {...methods}>
                <Form {...methods}>
                  <form onSubmit={handleSubmit(onSubmit)} className="space-y-10">
                    {step === 0 && (
                      <Section title="Eligibility Check" description="We make sure you meet the basics before continuing.">
                        <FormField
                          name="ownsVehicle"
                          control={control}
                          render={({ field }) => (
                            <FormItem className="col-span-2">
                              <FormLabel>Do you own a vehicle?</FormLabel>
                              <div className="flex items-center gap-4 mt-2">
                                <div className="flex items-center gap-2">
                                  <Checkbox checked={!!field.value} onCheckedChange={(v) => field.onChange(Boolean(v))} id="owns-yes" />
                                  <Label htmlFor="owns-yes">Yes, I own a truck</Label>
                                </div>
                              </div>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          name="eligibilityCapacityTons"
                          control={control}
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Vehicle capacity (tons)</FormLabel>
                              <FormControl>
                                <Input
                                  inputMode="decimal"
                                  type="number"
                                  min={1}
                                  max={15}
                                  step="0.1"
                                  placeholder="1–15"
                                  value={field.value ?? ""}
                                  onChange={(e) => field.onChange(Number(e.target.value))}
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          name="hasRequiredDocs"
                          control={control}
                          render={({ field }) => (
                            <FormItem className="col-span-2">
                              <FormLabel>Required documents</FormLabel>
                              <div className="flex items-start gap-3 mt-2">
                                <Checkbox checked={!!field.value} onCheckedChange={(v) => field.onChange(Boolean(v))} id="docs" />
                                <Label htmlFor="docs" className="text-sm text-muted-foreground">
                                  I have proof of ownership, a valid roadworthy certificate and insurance
                                </Label>
                              </div>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        {!eligibilityStatus.ok && (
                          <div className="col-span-2 rounded-md border border-destructive/30 bg-destructive/5 px-4 py-3 text-destructive">
                            {eligibilityStatus.reason}
                          </div>
                        )}
                      </Section>
                    )}

                    {step === 1 && (
                      <Section title="Basic Info" description="Your contact details and entity type.">
                        <FormField name="fullName" control={control} render={({ field }) => (
                          <FormItem>
                            <FormLabel>Full name</FormLabel>
                            <FormControl><Input {...field} /></FormControl>
                            <FormMessage />
                          </FormItem>
                        )} />
                        <FormField name="idNumber" control={control} render={({ field }) => (
                          <FormItem>
                            <FormLabel>ID or Passport number</FormLabel>
                            <FormControl><Input {...field} /></FormControl>
                            <FormMessage />
                          </FormItem>
                        )} />
                        <FormField name="entityType" control={control} render={({ field }) => (
                          <FormItem>
                            <FormLabel>Entity type</FormLabel>
                            <Select value={field.value} onValueChange={field.onChange}>
                              <FormControl>
                                <SelectTrigger>
                                  <SelectValue placeholder="Select type" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                <SelectItem value="individual">Individual</SelectItem>
                                <SelectItem value="business">Business</SelectItem>
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )} />
                        {entityType === "business" && (
                          <FormField name="businessName" control={control} render={({ field }) => (
                            <FormItem>
                              <FormLabel>Business name</FormLabel>
                              <FormControl><Input {...field} /></FormControl>
                              <FormMessage />
                            </FormItem>
                          )} />
                        )}
                        <FormField name="mobile" control={control} render={({ field }) => (
                          <FormItem>
                            <FormLabel>Mobile number</FormLabel>
                            <FormControl><Input placeholder="e.g. 0821234567 or +27821234567" {...field} /></FormControl>
                            <FormMessage />
                          </FormItem>
                        )} />
                        <FormField name="email" control={control} render={({ field }) => (
                          <FormItem>
                            <FormLabel>Email</FormLabel>
                            <FormControl><Input type="email" {...field} /></FormControl>
                            <FormMessage />
                          </FormItem>
                        )} />
                        <FormField name="address" control={control} render={({ field }) => (
                          <FormItem className="sm:col-span-2">
                            <FormLabel>Physical address</FormLabel>
                            <FormControl><Input {...field} /></FormControl>
                            <FormMessage />
                          </FormItem>
                        )} />
                        <FormField name="province" control={control} render={({ field }) => (
                          <FormItem>
                            <FormLabel>Province / Region</FormLabel>
                            <Select value={field.value} onValueChange={field.onChange}>
                              <FormControl>
                                <SelectTrigger>
                                  <SelectValue placeholder="Select province" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                {PROVINCES.map((p) => (
                                  <SelectItem key={p} value={p}>{p}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )} />
                      </Section>
                    )}

                    {step === 2 && (
                      <Section title="Vehicle Info" description="Fleet details and documents.">
                        <FormField name="numberOfTrucks" control={control} render={({ field }) => (
                          <FormItem>
                            <FormLabel>Number of trucks</FormLabel>
                            <FormControl>
                              <Input type="number" min={1} value={field.value ?? ""} onChange={(e) => field.onChange(Number(e.target.value))} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )} />
                        <FormField name="vehicleType" control={control} render={({ field }) => (
                          <FormItem>
                            <FormLabel>Vehicle type</FormLabel>
                            <Select value={field.value} onValueChange={field.onChange}>
                              <FormControl>
                                <SelectTrigger>
                                  <SelectValue placeholder="Select type" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                {[
                                  "Flatbed",
                                  "Box Truck",
                                  "Tipper",
                                  "Refrigerated",
                                  "Tanker",
                                  "Other",
                                ].map((t) => (
                                  <SelectItem key={t} value={t}>{t}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )} />
                        <FormField name="loadCapacity" control={control} render={({ field }) => (
                          <FormItem>
                            <FormLabel>Load capacity (tons)</FormLabel>
                            <FormControl>
                              <Input type="number" min={1} max={15} step="0.1" value={field.value ?? ""} onChange={(e) => field.onChange(Number(e.target.value))} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )} />
                        <FormField name="registrationNumber" control={control} render={({ field }) => (
                          <FormItem>
                            <FormLabel>Registration number</FormLabel>
                            <FormControl><Input {...field} /></FormControl>
                            <FormMessage />
                          </FormItem>
                        )} />
                        <FileField name={"proofOfOwnership"} label="Proof of ownership (PDF/JPG/PNG)" accept=".pdf,.jpg,.jpeg,.png" required />
                        <FileField name={"roadworthyCert"} label="Roadworthy certificate (PDF/JPG/PNG)" accept=".pdf,.jpg,.jpeg,.png" required />
                        <FileField name={"insuranceCert"} label="Insurance certificate (PDF/JPG/PNG)" accept=".pdf,.jpg,.jpeg,.png" required />
                        <FileField name={"vehiclePhoto"} label="Vehicle photo (optional)" accept="image/*" />
                      </Section>
                    )}

                    {step === 3 && (
                      <Section title="Banking Info" description="For payouts and invoices.">
                        <FormField name="bankName" control={control} render={({ field }) => (
                          <FormItem>
                            <FormLabel>Bank name</FormLabel>
                            <FormControl><Input {...field} /></FormControl>
                            <FormMessage />
                          </FormItem>
                        )} />
                        <FormField name="accountHolder" control={control} render={({ field }) => (
                          <FormItem>
                            <FormLabel>Account holder</FormLabel>
                            <FormControl><Input {...field} /></FormControl>
                            <FormMessage />
                          </FormItem>
                        )} />
                        <FormField name="accountNumber" control={control} render={({ field }) => (
                          <FormItem>
                            <FormLabel>Account number</FormLabel>
                            <FormControl><Input inputMode="numeric" {...field} /></FormControl>
                            <FormMessage />
                          </FormItem>
                        )} />
                        <FormField name="accountType" control={control} render={({ field }) => (
                          <FormItem>
                            <FormLabel>Account type</FormLabel>
                            <Select value={field.value} onValueChange={field.onChange}>
                              <FormControl>
                                <SelectTrigger>
                                  <SelectValue placeholder="Select type" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                <SelectItem value="cheque">Cheque</SelectItem>
                                <SelectItem value="savings">Savings</SelectItem>
                                <SelectItem value="business">Business</SelectItem>
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )} />
                        <FormField name="branchCode" control={control} render={({ field }) => (
                          <FormItem>
                            <FormLabel>Branch code</FormLabel>
                            <FormControl><Input inputMode="numeric" {...field} /></FormControl>
                            <FormMessage />
                          </FormItem>
                        )} />
                        <FileField name={"proofOfBank"} label="Proof of bank account" accept=".pdf,.jpg,.jpeg,.png" required />
                      </Section>
                    )}

                    {step === 4 && (
                      <Section title="Terms & Consent" description="Please review and accept to continue.">
                        <FormField name="acceptTerms" control={control} render={({ field }) => (
                          <FormItem className="col-span-2">
                            <div className="flex items-start gap-3">
                              <Checkbox checked={!!field.value} onCheckedChange={(v) => field.onChange(Boolean(v))} id="t1" />
                              <Label htmlFor="t1" className="text-sm">I accept the Terms of Use</Label>
                              <Dialog>
                                <DialogTrigger asChild>
                                  <Button variant="link" type="button" className="px-0">View</Button>
                                </DialogTrigger>
                                <DialogContent>
                                  <DialogHeader>
                                    <DialogTitle>Terms of Use (Preview)</DialogTitle>
                                  </DialogHeader>
                                  <div className="space-y-3 text-sm text-muted-foreground">
                                    <p>By continuing, you agree to provide accurate information and maintain valid documentation for your fleet.</p>
                                    <p>Data is processed according to our privacy policy. You can request deletion at any time.</p>
                                  </div>
                                </DialogContent>
                              </Dialog>
                            </div>
                            <FormMessage />
                          </FormItem>
                        )} />
                        <FormField name="consentStore" control={control} render={({ field }) => (
                          <FormItem className="col-span-2">
                            <div className="flex items-start gap-3">
                              <Checkbox checked={!!field.value} onCheckedChange={(v) => field.onChange(Boolean(v))} id="t2" />
                              <Label htmlFor="t2" className="text-sm">I consent to storage of my data</Label>
                            </div>
                            <FormMessage />
                          </FormItem>
                        )} />
                        <FormField name="consentContact" control={control} render={({ field }) => (
                          <FormItem className="col-span-2">
                            <div className="flex items-start gap-3">
                              <Checkbox checked={!!field.value} onCheckedChange={(v) => field.onChange(Boolean(v))} id="t3" />
                              <Label htmlFor="t3" className="text-sm">I consent to be contacted</Label>
                            </div>
                            <FormMessage />
                          </FormItem>
                        )} />
                      </Section>
                    )}

                    <div className="flex items-center justify-between border-t pt-4 mt-2">
                      <Button type="button" variant="secondary" onClick={goBack} disabled={step === 0}>
                        Back
                      </Button>
                      {step < steps.length - 1 ? (
                        <Button type="button" onClick={goNext} disabled={step === 0 && !eligibilityStatus.ok}>
                          Continue
                        </Button>
                      ) : (
                        <Button type="submit">Submit</Button>
                      )}
                    </div>

                    {step === steps.length - 1 && (
                      <div className="rounded-lg border bg-accent p-6 text-center">
                        <h3 className="text-lg font-medium">Thank you</h3>
                        <p className="text-sm text-muted-foreground mt-1">We will review and contact you.</p>
                      </div>
                    )}
                  </form>
                </Form>
              </FormProvider>
            </CardContent>
          </Card>
        </div>
      </div>
    </main>
  );
};

export default Index;
