import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";

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
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          Import Contacts
          {props.contactCount > 0 && (
            <Badge variant="secondary">{props.contactCount} imported</Badge>
          )}
        </CardTitle>
        <CardDescription>
          Upload or paste a LinkedIn Connections CSV to import your contacts.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="csv-file">Upload CSV file</Label>
          <input
            id="csv-file"
            type="file"
            accept=".csv,text/csv"
            className="flex h-9 w-full cursor-pointer rounded-md border border-input bg-transparent px-3 py-1 text-sm text-muted-foreground file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground"
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
          />
        </div>

        <Button
          disabled={props.isImporting || csvText.trim().length === 0}
          onClick={() => void props.onImportCsv(csvText)}
        >
          {props.isImporting ? "Importing..." : "Import CSV Contacts"}
        </Button>
      </CardContent>
    </Card>
  );
}
