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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Check,
  AlertCircle,
  CheckCircle,
  Sparkles,
  Truck,
  Plus,
  Minus,
  ChevronLeft,
  ChevronRight,
  FileText,
  Upload,
  X,
} from "lucide-react";
import confetti from "canvas-confetti";

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

const formSchema = z
  .object({
    // Eligibility
    ownsVehicle: z.enum(["yes", "no"], {
      required_error: "Please select if you own a vehicle",
    }),
    eligibilityCapacityTons: z.number(),
    hasRequiredDocs: z.enum(["yes", "no"], {
      required_error: "Please confirm you have required documents",
    }),

    // Step 1: Basic Info
    fullName: z.string().min(2, "Enter full name"),
    idNumber: z.string().min(5, "Enter ID or Passport number"),
    entityType: z.enum(["individual", "business"], {
      required_error: "Select an entity type",
    }),
    businessName: z.string().optional(),
    cipcNumber: z.string().optional(),
    mobile: z.string().regex(PHONE_REGEX, "Enter a valid South African number"),
    email: z.string().email("Enter a valid email"),
    address: z.string().min(5, "Enter a physical address"),
    province: z.string().min(2, "Select a province or region"),

    // Step 2: Vehicle Info
    numberOfTrucks: z.number().int().min(1, "Must be at least 1"),
    trucks: z
      .array(
        z.object({
          vehicleType: z.string().min(2, "Select a vehicle type"),
          loadCapacity: z.number().min(1, "Min 1T").max(15, "Max 15T"),
          registrationNumber: z.string().min(3, "Enter registration number"),
        })
      )
      .min(1, "At least one truck is required"),
    vehicleDocuments: z
      .array(z.any())
      .min(1, "Please upload at least one document"),

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
    acceptTerms: z.enum(["yes"], {
      required_error: "You must accept the Terms of Use",
    }),
    consentStore: z.enum(["yes"], {
      required_error: "You must consent to data storage",
    }),
    consentContact: z.enum(["yes"], {
      required_error: "You must consent to be contacted",
    }),
  })
  .refine(
    (data) => {
      if (data.entityType === "business") {
        return !!data.businessName && data.businessName.length > 1;
      }
      return true;
    },
    {
      message: "Enter business name",
      path: ["businessName"],
    }
  )
  .refine(
    (data) => {
      if (data.entityType === "business") {
        return !!data.cipcNumber && data.cipcNumber.length > 1;
      }
      return true;
    },
    {
      message: "Enter CIPC registration number",
      path: ["cipcNumber"],
    }
  )
  .refine(
    (data) =>
      data.eligibilityCapacityTons >= 1 && data.eligibilityCapacityTons <= 15,
    {
      message: "Capacity must be between 1T and 15T",
      path: ["eligibilityCapacityTons"],
    }
  );

type FormValues = z.infer<typeof formSchema>;

const defaultValues: FormValues = {
  // eligibility
  ownsVehicle: undefined as any,
  eligibilityCapacityTons: 0,
  hasRequiredDocs: undefined as any,
  // step 1
  fullName: "",
  idNumber: "",
  entityType: "individual",
  businessName: "",
  cipcNumber: "",
  mobile: "",
  email: "",
  address: "",
  province: "",
  // step 2
  numberOfTrucks: 1,
  trucks: [
    {
      vehicleType: "",
      loadCapacity: 1,
      registrationNumber: "",
    },
  ],
  vehicleDocuments: [],
  // step 3
  bankName: "",
  accountHolder: "",
  accountNumber: "",
  accountType: undefined as any,
  branchCode: "",
  proofOfBank: undefined,
  // step 4
  acceptTerms: undefined as any,
  consentStore: undefined as any,
  consentContact: undefined as any,
};

const steps = [
  { key: "eligibility", title: "Eligibility" },
  { key: "basic", title: "Basic Info" },
  { key: "vehicle", title: "Vehicle" },
  { key: "banking", title: "Banking" },
  { key: "terms", title: "Terms" },
];

function Stepper({
  current,
  onStepClick,
}: {
  current: number;
  onStepClick?: (i: number) => void;
}) {
  return (
    <ol className="flex items-center justify-between w-full mb-8">
      {steps.map((s, i) => {
        const active = i === current;
        const done = i < current;
        return (
          <li
            key={s.key}
            className={[
              "flex items-center gap-2",
              done ? "cursor-pointer" : "",
            ].join(" ")}
            aria-current={active ? "step" : undefined}
            onClick={() => done && onStepClick?.(i)}
          >
            <div
              className={[
                "flex h-8 w-8 items-center justify-center rounded-full border-2 text-sm font-medium transition-colors",
                done
                  ? "bg-primary text-primary-foreground border-primary"
                  : active
                  ? "border-primary text-primary bg-primary/10"
                  : "border-muted-foreground/30 text-muted-foreground",
              ].join(" ")}
            >
              {done ? <Check className="h-4 w-4" /> : i + 1}
            </div>
            <div className="hidden sm:block text-sm font-sans font-medium text-muted-foreground">
              {s.title}
            </div>
          </li>
        );
      })}
    </ol>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-6">
      <h2 className="text-xl font-heading font-semibold">{title}</h2>
      <div className="grid gap-4 sm:grid-cols-2">{children}</div>
    </section>
  );
}

function FileField({
  name,
  label,
  accept,
}: {
  name: keyof FormValues;
  label: string;
  accept?: string;
}) {
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
          {field.value && (
            <div className="mt-2 flex items-center justify-between rounded-md border px-3 py-2 text-sm">
              <span className="truncate">
                {field.value?.name} ({Math.round(field.value.size / 1024)} KB)
              </span>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => field.onChange(undefined)}
              >
                Clear
              </Button>
            </div>
          )}
          {fieldState.error && <FormMessage />}
        </FormItem>
      )}
    />
  );
}

function TruckFileField({
  name,
  label,
  accept,
  truckIndex,
}: {
  name: string;
  label: string;
  accept?: string;
  truckIndex: number;
}) {
  return (
    <FormField
      name={`trucks.${truckIndex}.${name}` as any}
      render={({ field, fieldState }) => (
        <FormItem>
          {label && <FormLabel>{label}</FormLabel>}
          <FormControl>
            <div className="space-y-2">
              <Input
                type="file"
                accept={accept}
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  field.onChange(file);
                }}
                className="file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-medium file:bg-primary file:text-primary-foreground hover:file:bg-primary/90"
              />
              {!field.value && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <span>Choose file</span>
                  <span>No file chosen</span>
                </div>
              )}
            </div>
          </FormControl>
          {field.value && (
            <div className="mt-2 flex items-center justify-between rounded-md border px-3 py-2 text-sm bg-muted/50">
              <span className="truncate">
                {field.value?.name} ({Math.round(field.value.size / 1024)} KB)
              </span>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => field.onChange(undefined)}
                className="text-muted-foreground hover:text-destructive"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          )}
          {fieldState.error && <FormMessage />}
        </FormItem>
      )}
    />
  );
}

function MultiFileUpload() {
  return (
    <FormField
      name="vehicleDocuments"
      render={({ field, fieldState }) => (
        <FormItem>
          <FormLabel className="text-base font-sans font-medium">
            Additional Vehicle Documents
          </FormLabel>
          <FormControl>
            <div className="space-y-4">
              <div className="border-2 border-dashed border-muted-foreground/25 rounded-lg p-6 text-center hover:border-muted-foreground/50 transition-colors bg-muted/20">
                <Input
                  type="file"
                  multiple
                  accept=".pdf,.jpg,.jpeg,.png"
                  onChange={(e) => {
                    const files = Array.from(e.target.files || []);
                    const currentFiles = field.value || [];
                    field.onChange([...currentFiles, ...files]);
                  }}
                  className="hidden"
                  id="vehicle-documents"
                />
                <label
                  htmlFor="vehicle-documents"
                  className="cursor-pointer flex flex-col items-center gap-3"
                >
                  <Upload className="h-8 w-8 text-muted-foreground" />
                  <div className="text-sm">
                    <span className="font-medium text-primary">
                      Click to upload
                    </span>
                    <span className="text-muted-foreground">
                      {" "}
                      or drag and drop
                    </span>
                  </div>
                  <div className="text-xs text-muted-foreground">
                    PDF, JPG, PNG files (multiple files allowed)
                  </div>
                </label>
              </div>

              {/* Display uploaded files */}
              {field.value && field.value.length > 0 && (
                <div className="space-y-3">
                  <div className="text-sm font-medium">
                    Uploaded Documents ({field.value.length})
                  </div>
                  <div className="space-y-2 max-h-40 overflow-y-auto">
                    {field.value.map((file: File, index: number) => (
                      <div
                        key={index}
                        className="flex items-center justify-between p-3 bg-muted/50 rounded-lg border"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <FileText className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                          <div className="min-w-0">
                            <div className="text-sm font-medium truncate">
                              {file.name}
                            </div>
                            <div className="text-xs text-muted-foreground">
                              {Math.round(file.size / 1024)} KB
                            </div>
                          </div>
                        </div>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            const newFiles = [...field.value];
                            newFiles.splice(index, 1);
                            field.onChange(newFiles);
                          }}
                          className="text-muted-foreground hover:text-destructive flex-shrink-0"
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </FormControl>
          <div className="text-xs text-muted-foreground">
            Upload any additional documents for your vehicles (roadworthy
            certificates, insurance, photos, etc.)
          </div>
          {fieldState.error && <FormMessage />}
        </FormItem>
      )}
    />
  );
}

const Index = () => {
  const [step, setStep] = useState(0);
  const [isSuccess, setIsSuccess] = useState(false);
  const [showEligibilityModal, setShowEligibilityModal] = useState(false);
  const [currentTruckIndex, setCurrentTruckIndex] = useState(0);
  const methods = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues,
    mode: "onChange",
  });
  const { control, handleSubmit, trigger, watch, setValue, getValues } =
    methods;

  useEffect(() => {
    document.title = "Hauler Onboarding – Premium Red Flow";
    const desc =
      "Professional hauler onboarding with eligibility checks, vehicle and banking verification.";
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
      "@context": "https://schema.org/",
      "@type": "HowTo",
      name: "Hauler Onboarding Flow",
      description: desc,
      step: steps.map((s, i) => ({
        "@type": "HowToStep",
        position: i + 1,
        name: s.title,
        text: `Complete the ${s.title.toLowerCase()} step of the hauler onboarding process.`,
      })),
    };
    const existing = document.getElementById(
      "jsonld-howto"
    ) as HTMLScriptElement | null;
    const script =
      existing || (document.createElement("script") as HTMLScriptElement);
    script.id = "jsonld-howto";
    script.type = "application/ld+json";
    script.textContent = JSON.stringify(howTo);
    if (!existing) document.head.appendChild(script);
  }, []);

  const entityType = watch("entityType");
  const ownsVehicle = watch("ownsVehicle");
  const eligCap = watch("eligibilityCapacityTons");
  const hasDocs = watch("hasRequiredDocs");
  const numberOfTrucks = watch("numberOfTrucks");
  const trucks = watch("trucks");

  // Helper function to check if a truck is complete
  const isTruckComplete = (truck: any) => {
    return truck && truck.vehicleType && truck.registrationNumber;
  };

  // Calculate completion stats
  const completedTrucks = trucks ? trucks.filter(isTruckComplete).length : 0;
  const completionPercentage =
    numberOfTrucks > 0 ? (completedTrucks / numberOfTrucks) * 100 : 0;

  // Update trucks array when numberOfTrucks changes
  useEffect(() => {
    if (numberOfTrucks && trucks) {
      const currentTrucks = [...trucks];

      if (numberOfTrucks > currentTrucks.length) {
        // Add new trucks
        for (let i = currentTrucks.length; i < numberOfTrucks; i++) {
          currentTrucks.push({
            vehicleType: "",
            loadCapacity: 1,
            registrationNumber: "",
          });
        }
      } else if (numberOfTrucks < currentTrucks.length) {
        // Remove excess trucks
        currentTrucks.splice(numberOfTrucks);
      }

      setValue("trucks", currentTrucks);

      // Reset current truck index if it's out of bounds
      if (currentTruckIndex >= numberOfTrucks) {
        setCurrentTruckIndex(0);
      }
    }
  }, [numberOfTrucks, setValue, currentTruckIndex]);

  const eligibilityStatus = useMemo(() => {
    if (ownsVehicle !== "yes")
      return { ok: false, reason: "Reject: Driver only not allowed" };
    if (!(eligCap >= 1 && eligCap <= 15))
      return { ok: false, reason: "Reject: Invalid truck size" };
    if (hasDocs !== "yes")
      return {
        ok: false,
        reason: "Reject: Missing roadworthy or insurance",
      };
    return { ok: true } as const;
  }, [ownsVehicle, eligCap, hasDocs]);
  const progressPct = Math.round((step / (steps.length - 1)) * 100);
  const goNext = async () => {
    const fieldsByStep: (keyof FormValues)[][] = [
      ["ownsVehicle", "eligibilityCapacityTons", "hasRequiredDocs"],
      [
        "fullName",
        "idNumber",
        "entityType",
        "businessName",
        "cipcNumber",
        "mobile",
        "email",
        "address",
        "province",
      ],
      ["numberOfTrucks", "trucks", "vehicleDocuments"],
      [
        "bankName",
        "accountHolder",
        "accountNumber",
        "accountType",
        "branchCode",
        "proofOfBank",
      ],
      ["acceptTerms", "consentStore", "consentContact"],
    ];

    // Special validation for vehicle step to ensure all trucks are complete
    if (step === 2) {
      const currentTrucks = getValues("trucks");
      const numTrucks = getValues("numberOfTrucks");

      if (!currentTrucks || currentTrucks.length !== numTrucks) {
        return;
      }

      // Check if all trucks have required fields
      const incompleteTrucks = [];
      for (let i = 0; i < numTrucks; i++) {
        const truck = currentTrucks[i];
        if (!truck.vehicleType || !truck.registrationNumber) {
          incompleteTrucks.push(i + 1);
        }
      }

      if (incompleteTrucks.length > 0) {
        // Switch to the first incomplete truck
        const firstIncomplete = incompleteTrucks[0] - 1;
        setCurrentTruckIndex(firstIncomplete);
        await trigger(`trucks.${firstIncomplete}` as any, {
          shouldFocus: true,
        });
        return;
      }

      // Check if documents are uploaded
      const documents = getValues("vehicleDocuments");
      if (!documents || documents.length === 0) {
        await trigger("vehicleDocuments" as any, { shouldFocus: true });
        return;
      }
    }

    const valid = await trigger(fieldsByStep[step] as any, {
      shouldFocus: true,
    });
    if (!valid) return;

    // Show eligibility modal if user doesn't qualify on step 0
    if (step === 0 && !eligibilityStatus.ok) {
      setShowEligibilityModal(true);
      return;
    }

    setStep((s) => Math.min(s + 1, steps.length - 1));
  };

  const goBack = () => setStep((s) => Math.max(0, s - 1));

  const triggerConfetti = () => {
    confetti({
      particleCount: 100,
      spread: 70,
      origin: { y: 0.6 },
    });
  };

  const onSubmit: SubmitHandler<FormValues> = async (data) => {
    console.log("Onboarding submitted", data);
    setIsSuccess(true);
    triggerConfetti();
    setTimeout(triggerConfetti, 300);
  };

  return (
    <main className="min-h-screen relative">
      {/* Signature ambient gradient */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{ background: "var(--gradient-brand)" }}
      />

      <div className="min-h-screen flex items-center justify-center px-4 py-10 md:py-16">
        <h1 className="sr-only">Hauler Onboarding Flow</h1>
        <div className="w-full max-w-3xl">
          <Card className="relative border bg-card shadow-[var(--shadow-elevated)] animate-fade-in">
            <div className="absolute inset-x-0 top-0 h-1 bg-border">
              <div
                className="h-1 bg-primary transition-all"
                style={{ width: `${progressPct}%` }}
              />
            </div>
            <CardHeader className="space-y-2">
              <CardTitle className="text-2xl font-heading font-semibold">
                Hauler Onboarding
              </CardTitle>
              <CardDescription>Quick setup to get you started</CardDescription>
              {!isSuccess && (
                <Stepper current={step} onStepClick={(i) => setStep(i)} />
              )}
            </CardHeader>
            <CardContent>
              {isSuccess ? (
                <div className="text-center py-12 space-y-6">
                  <div className="mx-auto w-16 h-16 bg-green-100 rounded-full flex items-center justify-center">
                    <CheckCircle className="w-8 h-8 text-green-600" />
                  </div>
                  <div className="space-y-2">
                    <h3 className="text-2xl font-heading font-semibold">
                      Application Submitted!
                    </h3>
                    <p className="text-muted-foreground">
                      We'll review your application and get back to you soon.
                    </p>
                  </div>
                  <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
                    <Sparkles className="w-4 h-4" />
                    <span>Thank you for joining our network</span>
                  </div>
                </div>
              ) : (
                <FormProvider {...methods}>
                  <Form {...methods}>
                    <form
                      onSubmit={handleSubmit(onSubmit)}
                      className="space-y-8"
                    >
                      {step === 0 && (
                        <Section title="Eligibility Check">
                          <FormField
                            name="ownsVehicle"
                            control={control}
                            render={({ field }) => (
                              <FormItem className="col-span-2">
                                <FormLabel>Own a vehicle?</FormLabel>
                                <FormControl>
                                  <RadioGroup
                                    value={field.value}
                                    onValueChange={field.onChange}
                                    className="flex gap-6 mt-2"
                                  >
                                    <div className="flex items-center space-x-2">
                                      <RadioGroupItem
                                        value="yes"
                                        id="owns-yes"
                                      />
                                      <Label htmlFor="owns-yes">Yes</Label>
                                    </div>
                                    <div className="flex items-center space-x-2">
                                      <RadioGroupItem value="no" id="owns-no" />
                                      <Label htmlFor="owns-no">No</Label>
                                    </div>
                                  </RadioGroup>
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                          <FormField
                            name="eligibilityCapacityTons"
                            control={control}
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Capacity (tons)</FormLabel>
                                <FormControl>
                                  <Input
                                    inputMode="decimal"
                                    type="number"
                                    min={1}
                                    max={15}
                                    step="0.1"
                                    placeholder="1–15"
                                    value={field.value ?? ""}
                                    onChange={(e) =>
                                      field.onChange(Number(e.target.value))
                                    }
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
                                <FormLabel>
                                  Have roadworthy & insurance?
                                </FormLabel>
                                <FormControl>
                                  <RadioGroup
                                    value={field.value}
                                    onValueChange={field.onChange}
                                    className="flex gap-6 mt-2"
                                  >
                                    <div className="flex items-center space-x-2">
                                      <RadioGroupItem
                                        value="yes"
                                        id="docs-yes"
                                      />
                                      <Label htmlFor="docs-yes">Yes</Label>
                                    </div>
                                    <div className="flex items-center space-x-2">
                                      <RadioGroupItem value="no" id="docs-no" />
                                      <Label htmlFor="docs-no">No</Label>
                                    </div>
                                  </RadioGroup>
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                        </Section>
                      )}

                      {step === 1 && (
                        <Section title="Basic Info">
                          <FormField
                            name="fullName"
                            control={control}
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Name</FormLabel>
                                <FormControl>
                                  <Input autoComplete="name" {...field} />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                          <FormField
                            name="idNumber"
                            control={control}
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>ID/Passport</FormLabel>
                                <FormControl>
                                  <Input autoComplete="off" {...field} />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                          <FormField
                            name="entityType"
                            control={control}
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Type</FormLabel>
                                <Select
                                  value={field.value}
                                  onValueChange={field.onChange}
                                >
                                  <FormControl>
                                    <SelectTrigger>
                                      <SelectValue placeholder="Select" />
                                    </SelectTrigger>
                                  </FormControl>
                                  <SelectContent>
                                    <SelectItem value="individual">
                                      Individual
                                    </SelectItem>
                                    <SelectItem value="business">
                                      Business
                                    </SelectItem>
                                  </SelectContent>
                                </Select>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                          {entityType === "business" && (
                            <>
                              <FormField
                                name="businessName"
                                control={control}
                                render={({ field }) => (
                                  <FormItem>
                                    <FormLabel>Business Name</FormLabel>
                                    <FormControl>
                                      <Input {...field} />
                                    </FormControl>
                                    <FormMessage />
                                  </FormItem>
                                )}
                              />
                              <FormField
                                name="cipcNumber"
                                control={control}
                                render={({ field }) => (
                                  <FormItem>
                                    <FormLabel>CIPC Number</FormLabel>
                                    <FormControl>
                                      <Input {...field} />
                                    </FormControl>
                                    <FormMessage />
                                  </FormItem>
                                )}
                              />
                            </>
                          )}
                          <FormField
                            name="mobile"
                            control={control}
                            render={({ field, fieldState }) => (
                              <FormItem>
                                <FormLabel>Mobile</FormLabel>
                                <FormControl>
                                  <Input
                                    placeholder="0821234567"
                                    autoComplete="tel"
                                    className={
                                      fieldState.invalid
                                        ? "border-destructive focus-visible:ring-destructive"
                                        : undefined
                                    }
                                    {...field}
                                  />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                          <FormField
                            name="email"
                            control={control}
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Email</FormLabel>
                                <FormControl>
                                  <Input
                                    type="email"
                                    autoComplete="email"
                                    {...field}
                                  />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                          <FormField
                            name="address"
                            control={control}
                            render={({ field }) => (
                              <FormItem className="sm:col-span-2">
                                <FormLabel>Address</FormLabel>
                                <FormControl>
                                  <Input
                                    autoComplete="street-address"
                                    {...field}
                                  />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                          <FormField
                            name="province"
                            control={control}
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Province</FormLabel>
                                <Select
                                  value={field.value}
                                  onValueChange={field.onChange}
                                >
                                  <FormControl>
                                    <SelectTrigger>
                                      <SelectValue placeholder="Select" />
                                    </SelectTrigger>
                                  </FormControl>
                                  <SelectContent>
                                    {PROVINCES.map((p) => (
                                      <SelectItem key={p} value={p}>
                                        {p}
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                        </Section>
                      )}

                      {step === 2 && (
                        <div className="space-y-8">
                          <h2 className="text-xl font-heading font-semibold">
                            Vehicle Info
                          </h2>

                          {/* Number of Trucks */}
                          <div className="space-y-4">
                            <FormField
                              name="numberOfTrucks"
                              control={control}
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel>Number of Trucks</FormLabel>
                                  <div className="flex items-center gap-3">
                                    <Button
                                      type="button"
                                      variant="outline"
                                      size="sm"
                                      onClick={() =>
                                        field.onChange(
                                          Math.max(1, (field.value || 1) - 1)
                                        )
                                      }
                                      disabled={(field.value || 1) <= 1}
                                    >
                                      <Minus className="h-4 w-4" />
                                    </Button>
                                    <span className="text-lg font-semibold min-w-[3ch] text-center">
                                      {field.value || 1}
                                    </span>
                                    <Button
                                      type="button"
                                      variant="outline"
                                      size="sm"
                                      onClick={() =>
                                        field.onChange(
                                          Math.min(10, (field.value || 1) + 1)
                                        )
                                      }
                                      disabled={(field.value || 1) >= 10}
                                    >
                                      <Plus className="h-4 w-4" />
                                    </Button>
                                  </div>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                          </div>

                          {/* Truck Details Section */}
                          {numberOfTrucks > 0 && trucks && (
                            <div className="space-y-6">
                              <div className="flex items-center justify-between">
                                <h3 className="text-lg font-heading font-medium flex items-center gap-2">
                                  <span className="bg-primary text-primary-foreground rounded-full w-6 h-6 flex items-center justify-center text-sm font-bold">
                                    2
                                  </span>
                                  Truck Details
                                </h3>
                                {numberOfTrucks > 1 && (
                                  <div className="text-sm text-muted-foreground">
                                    {completedTrucks} of {numberOfTrucks}{" "}
                                    completed
                                  </div>
                                )}
                              </div>

                              {/* Truck Tabs for Multiple Trucks */}
                              {numberOfTrucks > 1 && (
                                <div className="flex gap-2 overflow-x-auto pb-2">
                                  {Array.from(
                                    { length: numberOfTrucks },
                                    (_, i) => {
                                      const truck = trucks[i];
                                      const isComplete = isTruckComplete(truck);
                                      const isCurrent = i === currentTruckIndex;

                                      return (
                                        <div
                                          key={i}
                                          className={[
                                            "flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all whitespace-nowrap border group",
                                            isCurrent
                                              ? "bg-primary text-primary-foreground border-primary shadow-sm"
                                              : isComplete
                                              ? "bg-green-50 text-green-700 border-green-200 hover:bg-green-100"
                                              : "bg-background text-muted-foreground border-border hover:bg-muted hover:text-foreground",
                                          ].join(" ")}
                                        >
                                          <button
                                            type="button"
                                            onClick={() =>
                                              setCurrentTruckIndex(i)
                                            }
                                            className="flex items-center gap-2 flex-1"
                                          >
                                            <Truck className="h-4 w-4" />
                                            <span>Truck {i + 1}</span>
                                            {isComplete && (
                                              <CheckCircle className="h-4 w-4" />
                                            )}
                                          </button>
                                          {numberOfTrucks > 1 && (
                                            <button
                                              type="button"
                                              onClick={(e) => {
                                                e.stopPropagation();
                                                const currentTrucks = [
                                                  ...trucks,
                                                ];
                                                currentTrucks.splice(i, 1);
                                                setValue(
                                                  "trucks",
                                                  currentTrucks
                                                );
                                                setValue(
                                                  "numberOfTrucks",
                                                  numberOfTrucks - 1
                                                );

                                                // Adjust current truck index if needed
                                                if (currentTruckIndex >= i) {
                                                  setCurrentTruckIndex(
                                                    Math.max(
                                                      0,
                                                      currentTruckIndex - 1
                                                    )
                                                  );
                                                }
                                              }}
                                              className={[
                                                "opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded hover:bg-destructive/10",
                                                isCurrent
                                                  ? "text-primary-foreground hover:bg-white/20"
                                                  : "text-muted-foreground hover:text-destructive",
                                              ].join(" ")}
                                              title={`Remove Truck ${i + 1}`}
                                            >
                                              <X className="h-3 w-3" />
                                            </button>
                                          )}
                                        </div>
                                      );
                                    }
                                  )}
                                </div>
                              )}

                              {/* Current Truck Form */}
                              <div className="border rounded-lg p-6 space-y-6 bg-background">
                                <div className="flex items-center justify-between">
                                  <h4 className="text-lg font-heading font-medium flex items-center gap-2">
                                    <Truck className="h-5 w-5 text-primary" />
                                    Truck {currentTruckIndex + 1}
                                  </h4>
                                  <div className="flex gap-2">
                                    {numberOfTrucks > 1 && (
                                      <>
                                        <Button
                                          type="button"
                                          variant="outline"
                                          size="sm"
                                          onClick={() =>
                                            setCurrentTruckIndex(
                                              Math.max(0, currentTruckIndex - 1)
                                            )
                                          }
                                          disabled={currentTruckIndex === 0}
                                        >
                                          <ChevronLeft className="h-4 w-4" />
                                          Previous
                                        </Button>
                                        <Button
                                          type="button"
                                          variant="outline"
                                          size="sm"
                                          onClick={() =>
                                            setCurrentTruckIndex(
                                              Math.min(
                                                numberOfTrucks - 1,
                                                currentTruckIndex + 1
                                              )
                                            )
                                          }
                                          disabled={
                                            currentTruckIndex ===
                                            numberOfTrucks - 1
                                          }
                                        >
                                          Next
                                          <ChevronRight className="h-4 w-4" />
                                        </Button>
                                      </>
                                    )}
                                    {numberOfTrucks > 1 && (
                                      <Button
                                        type="button"
                                        variant="destructive"
                                        size="sm"
                                        onClick={() => {
                                          const currentTrucks = [...trucks];
                                          currentTrucks.splice(
                                            currentTruckIndex,
                                            1
                                          );
                                          setValue("trucks", currentTrucks);
                                          setValue(
                                            "numberOfTrucks",
                                            numberOfTrucks - 1
                                          );

                                          // Adjust current truck index if needed
                                          if (
                                            currentTruckIndex >=
                                            currentTrucks.length
                                          ) {
                                            setCurrentTruckIndex(
                                              Math.max(
                                                0,
                                                currentTrucks.length - 1
                                              )
                                            );
                                          }
                                        }}
                                      >
                                        <X className="h-4 w-4" />
                                        Remove
                                      </Button>
                                    )}
                                  </div>
                                </div>

                                {/* Basic Truck Info */}
                                <div className="grid gap-4 sm:grid-cols-2">
                                  <FormField
                                    name={`trucks.${currentTruckIndex}.vehicleType`}
                                    control={control}
                                    render={({ field }) => (
                                      <FormItem>
                                        <FormLabel>Vehicle Type</FormLabel>
                                        <Select
                                          value={field.value}
                                          onValueChange={field.onChange}
                                        >
                                          <FormControl>
                                            <SelectTrigger>
                                              <SelectValue placeholder="Select vehicle type" />
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
                                            ].map((type) => (
                                              <SelectItem
                                                key={type}
                                                value={type}
                                              >
                                                {type}
                                              </SelectItem>
                                            ))}
                                          </SelectContent>
                                        </Select>
                                        <FormMessage />
                                      </FormItem>
                                    )}
                                  />
                                  <FormField
                                    name={`trucks.${currentTruckIndex}.loadCapacity`}
                                    control={control}
                                    render={({ field }) => (
                                      <FormItem>
                                        <FormLabel>Load Capacity</FormLabel>
                                        <div className="relative">
                                          <FormControl>
                                            <Input
                                              type="number"
                                              min={1}
                                              max={15}
                                              step="0.1"
                                              placeholder="e.g. 3.5"
                                              value={field.value ?? ""}
                                              onChange={(e) =>
                                                field.onChange(
                                                  Number(e.target.value)
                                                )
                                              }
                                            />
                                          </FormControl>
                                          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
                                            tons
                                          </span>
                                        </div>
                                        <FormMessage />
                                      </FormItem>
                                    )}
                                  />
                                  <FormField
                                    name={`trucks.${currentTruckIndex}.registrationNumber`}
                                    control={control}
                                    render={({ field }) => (
                                      <FormItem className="sm:col-span-2">
                                        <FormLabel>
                                          Registration Number
                                        </FormLabel>
                                        <FormControl>
                                          <Input
                                            placeholder="e.g. ABC123GP"
                                            autoComplete="off"
                                            {...field}
                                          />
                                        </FormControl>
                                        <FormMessage />
                                      </FormItem>
                                    )}
                                  />
                                </div>

                                {/* Document Upload Section */}

                                {/* Completion Status */}
                                {(() => {
                                  const currentTruck =
                                    trucks[currentTruckIndex];
                                  const isComplete =
                                    isTruckComplete(currentTruck);

                                  return (
                                    <div
                                      className={[
                                        "flex items-center gap-2 p-3 rounded-lg text-sm border",
                                        isComplete
                                          ? "bg-green-50 text-green-700 border-green-200"
                                          : "bg-amber-50 text-amber-700 border-amber-200",
                                      ].join(" ")}
                                    >
                                      {isComplete ? (
                                        <>
                                          <CheckCircle className="h-4 w-4 text-green-600" />
                                          <span className="font-medium">
                                            This truck is complete and ready!
                                          </span>
                                        </>
                                      ) : (
                                        <>
                                          <AlertCircle className="h-4 w-4 text-amber-600" />
                                          <span>
                                            Please complete all required fields
                                            for this truck
                                          </span>
                                        </>
                                      )}
                                    </div>
                                  );
                                })()}
                              </div>

                              {/* Overall Progress for Multiple Trucks */}
                              {numberOfTrucks > 1 && (
                                <div
                                  className={[
                                    "rounded-lg p-4 border",
                                    completedTrucks === numberOfTrucks
                                      ? "bg-green-50 border-green-200"
                                      : "bg-muted/30 border-border",
                                  ].join(" ")}
                                >
                                  <div className="flex items-center justify-between mb-3">
                                    <span className="text-sm font-medium flex items-center gap-2">
                                      Overall Progress
                                      {completedTrucks === numberOfTrucks && (
                                        <CheckCircle className="h-4 w-4 text-green-600" />
                                      )}
                                    </span>
                                    <span
                                      className={[
                                        "text-sm",
                                        completedTrucks === numberOfTrucks
                                          ? "text-green-700 font-medium"
                                          : "text-muted-foreground",
                                      ].join(" ")}
                                    >
                                      {completedTrucks} of {numberOfTrucks}{" "}
                                      completed
                                    </span>
                                  </div>
                                  <div className="w-full bg-muted rounded-full h-2">
                                    <div
                                      className={[
                                        "h-2 rounded-full transition-all duration-300",
                                        completedTrucks === numberOfTrucks
                                          ? "bg-green-500"
                                          : "bg-primary",
                                      ].join(" ")}
                                      style={{
                                        width: `${completionPercentage}%`,
                                      }}
                                    />
                                  </div>
                                  {completedTrucks === numberOfTrucks && (
                                    <div className="mt-3 text-sm text-green-700 font-medium">
                                      🎉 All trucks completed! You're ready to
                                      continue.
                                    </div>
                                  )}
                                </div>
                              )}

                              {/* General Vehicle Documents Upload */}
                              <div className="space-y-4">
                                <h3 className="text-lg font-heading font-medium flex items-center gap-2">
                                  <span className="bg-primary text-primary-foreground rounded-full w-6 h-6 flex items-center justify-center text-sm font-bold">
                                    3
                                  </span>
                                  Additional Documents
                                </h3>
                                <MultiFileUpload />
                              </div>
                            </div>
                          )}
                        </div>
                      )}

                      {step === 3 && (
                        <Section title="Banking Info">
                          <FormField
                            name="bankName"
                            control={control}
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Bank</FormLabel>
                                <FormControl>
                                  <Input autoComplete="off" {...field} />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                          <FormField
                            name="accountHolder"
                            control={control}
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Account Holder</FormLabel>
                                <FormControl>
                                  <Input autoComplete="name" {...field} />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                          <FormField
                            name="accountNumber"
                            control={control}
                            render={({ field, fieldState }) => (
                              <FormItem>
                                <FormLabel>Account Number</FormLabel>
                                <FormControl>
                                  <Input
                                    inputMode="numeric"
                                    autoComplete="off"
                                    className={
                                      fieldState.invalid
                                        ? "border-destructive focus-visible:ring-destructive"
                                        : undefined
                                    }
                                    {...field}
                                  />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                          <FormField
                            name="accountType"
                            control={control}
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Account Type</FormLabel>
                                <Select
                                  value={field.value}
                                  onValueChange={field.onChange}
                                >
                                  <FormControl>
                                    <SelectTrigger>
                                      <SelectValue placeholder="Select" />
                                    </SelectTrigger>
                                  </FormControl>
                                  <SelectContent>
                                    <SelectItem value="cheque">
                                      Cheque
                                    </SelectItem>
                                    <SelectItem value="savings">
                                      Savings
                                    </SelectItem>
                                    <SelectItem value="business">
                                      Business
                                    </SelectItem>
                                  </SelectContent>
                                </Select>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                          <FormField
                            name="branchCode"
                            control={control}
                            render={({ field, fieldState }) => (
                              <FormItem>
                                <FormLabel>Branch Code</FormLabel>
                                <FormControl>
                                  <Input
                                    inputMode="numeric"
                                    autoComplete="off"
                                    placeholder="250655"
                                    className={
                                      fieldState.invalid
                                        ? "border-destructive focus-visible:ring-destructive"
                                        : undefined
                                    }
                                    {...field}
                                  />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                          <FileField
                            name={"proofOfBank"}
                            label="Bank Statement"
                            accept=".pdf,.jpg,.jpeg,.png"
                          />
                        </Section>
                      )}

                      {step === 4 && (
                        <Section title="Terms & Consent">
                          <FormField
                            name="acceptTerms"
                            control={control}
                            render={({ field }) => (
                              <FormItem className="col-span-2">
                                <FormControl>
                                  <RadioGroup
                                    value={field.value}
                                    onValueChange={field.onChange}
                                    className="space-y-3"
                                  >
                                    <div className="flex items-center space-x-2">
                                      <RadioGroupItem
                                        value="yes"
                                        id="terms-yes"
                                      />
                                      <Label
                                        htmlFor="terms-yes"
                                        className="text-sm"
                                      >
                                        Accept Terms of Use
                                      </Label>
                                    </div>
                                  </RadioGroup>
                                </FormControl>
                                <div className="mt-2">
                                  <Dialog>
                                    <DialogTrigger asChild>
                                      <Button
                                        variant="link"
                                        type="button"
                                        className="px-0 h-auto text-xs"
                                      >
                                        View Terms
                                      </Button>
                                    </DialogTrigger>
                                    <DialogContent>
                                      <DialogHeader>
                                        <DialogTitle>Terms of Use</DialogTitle>
                                      </DialogHeader>
                                      <div className="space-y-3 text-sm text-muted-foreground">
                                        <p>
                                          By continuing, you agree to provide
                                          accurate information and maintain
                                          valid documentation for your fleet.
                                        </p>
                                        <p>
                                          Data is processed according to our
                                          privacy policy. You can request
                                          deletion at any time.
                                        </p>
                                      </div>
                                    </DialogContent>
                                  </Dialog>
                                </div>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                          <FormField
                            name="consentStore"
                            control={control}
                            render={({ field }) => (
                              <FormItem className="col-span-2">
                                <FormControl>
                                  <RadioGroup
                                    value={field.value}
                                    onValueChange={field.onChange}
                                    className="space-y-3"
                                  >
                                    <div className="flex items-center space-x-2">
                                      <RadioGroupItem
                                        value="yes"
                                        id="store-yes"
                                      />
                                      <Label
                                        htmlFor="store-yes"
                                        className="text-sm"
                                      >
                                        Consent to data storage
                                      </Label>
                                    </div>
                                  </RadioGroup>
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                          <FormField
                            name="consentContact"
                            control={control}
                            render={({ field }) => (
                              <FormItem className="col-span-2">
                                <FormControl>
                                  <RadioGroup
                                    value={field.value}
                                    onValueChange={field.onChange}
                                    className="space-y-3"
                                  >
                                    <div className="flex items-center space-x-2">
                                      <RadioGroupItem
                                        value="yes"
                                        id="contact-yes"
                                      />
                                      <Label
                                        htmlFor="contact-yes"
                                        className="text-sm"
                                      >
                                        Consent to be contacted
                                      </Label>
                                    </div>
                                  </RadioGroup>
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                        </Section>
                      )}

                      <div className="sticky bottom-0 left-0 right-0 -mx-6 px-6 bg-card/90 backdrop-blur supports-[backdrop-filter]:bg-card/80 border-t pt-4 mt-2 z-10">
                        <div className="flex justify-between">
                          <Button
                            type="button"
                            variant="secondary"
                            onClick={goBack}
                            disabled={step === 0}
                          >
                            Back
                          </Button>
                          {step < steps.length - 1 ? (
                            <Button
                              type="button"
                              onClick={goNext}
                              disabled={step === 0 && !eligibilityStatus.ok}
                              className="transition-transform hover:-translate-y-0.5"
                            >
                              Continue
                            </Button>
                          ) : (
                            <Button
                              type="submit"
                              className="transition-transform hover:-translate-y-0.5"
                            >
                              Submit
                            </Button>
                          )}
                        </div>
                      </div>
                    </form>
                  </Form>
                </FormProvider>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Eligibility Modal */}
      <Dialog
        open={showEligibilityModal}
        onOpenChange={setShowEligibilityModal}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Application Requirements Not Met</DialogTitle>
            <DialogDescription>
              Unfortunately, you don't meet the current requirements for our
              hauler network.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="flex items-center gap-3 p-4 bg-destructive/10 rounded-lg">
              <AlertCircle className="h-5 w-5 text-destructive" />
              <p className="text-sm text-destructive font-medium">
                {eligibilityStatus.reason}
              </p>
            </div>
            <p className="text-sm text-muted-foreground">
              Please review the requirements and try again when you meet all
              criteria.
            </p>
            <div className="flex justify-end">
              <Button onClick={() => setShowEligibilityModal(false)}>
                Understood
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </main>
  );
};

export default Index;
