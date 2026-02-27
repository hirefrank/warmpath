import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Users, Upload } from "lucide-react";

interface ContactsImportPanelProps {
  contactCount: number;
  isImporting: boolean;
  onImportCsv: (csv: string) => Promise<void>;
}

export function ContactsImportPanel(props: ContactsImportPanelProps) {
  const [csvText, setCsvText] = useState("");

  async function handleFileChange(file: File | null): Promise<void> {
    if (!file) {
      return;
    }

    const text = await file.text();
    setCsvText(text);
  }

  return (
    <Card className="animate-fade-in-up overflow-hidden">
      <CardHeader className="border-b border-border/50 bg-accent/30">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="flex size-8 items-center justify-center rounded-lg bg-primary/10">
              <Users className="size-4 text-primary" />
            </div>
            <div>
              <CardTitle>Import Contacts</CardTitle>
              <CardDescription>
                Upload or paste a LinkedIn Connections CSV to import your network.
              </CardDescription>
            </div>
          </div>
          {props.contactCount > 0 && (
            <Badge variant="secondary" className="font-mono">
              {props.contactCount} imported
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-4 pt-5">
        <div className="space-y-2">
          <Label htmlFor="csv-file">Upload CSV file</Label>
          <label
            htmlFor="csv-file"
            className="flex cursor-pointer items-center justify-center gap-2 rounded-lg border-2 border-dashed border-border/60 bg-accent/20 px-4 py-6 text-sm text-muted-foreground transition-colors hover:border-primary/30 hover:bg-accent/40"
          >
            <Upload className="size-4" />
            <span>Drop a CSV file or click to browse</span>
          </label>
          <input
            id="csv-file"
            type="file"
            accept=".csv,text/csv"
            className="hidden"
            onChange={(event) => {
              const file = event.currentTarget.files?.[0] ?? null;
              void handleFileChange(file);
            }}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="csv-text">Or paste CSV content</Label>
          <Textarea
            id="csv-text"
            value={csvText}
            rows={8}
            placeholder="First Name,Last Name,Email Address,Company,Position,Connected On..."
            onChange={(event) => setCsvText(event.currentTarget.value)}
            className="font-mono text-xs"
          />
        </div>

        <Button
          disabled={props.isImporting || csvText.trim().length === 0}
          onClick={() => void props.onImportCsv(csvText)}
          className="gap-2"
        >
          {props.isImporting ? (
            <>
              <div className="size-4 animate-spin rounded-full border-2 border-primary-foreground/30 border-t-primary-foreground" />
              Importing...
            </>
          ) : (
            <>
              <Upload className="size-4" />
              Import CSV Contacts
            </>
          )}
        </Button>
      </CardContent>
    </Card>
  );
}
