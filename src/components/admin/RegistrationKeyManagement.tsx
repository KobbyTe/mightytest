import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useTeacherScope } from '@/hooks/useTeacherScope';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Plus, Key, Loader2, Search, Download, FileText } from 'lucide-react';
import { toast } from 'sonner';
import jsPDF from 'jspdf';

interface School {
  id: string;
  name: string;
  code: string;
}

interface ClassItem {
  id: string;
  name: string;
  school_id: string;
}

interface RegistrationKey {
  id: string;
  key_code: string;
  status: string;
  created_at: string;
  school: { name: string; code: string } | null;
  class: { name: string } | null;
  claimed_student: { full_name: string } | null;
}

export default function RegistrationKeyManagement() {
  const [keys, setKeys] = useState<RegistrationKey[]>([]);
  const [schools, setSchools] = useState<School[]>([]);
  const [classes, setClasses] = useState<ClassItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [bulkDialogOpen, setBulkDialogOpen] = useState(false);
  const [bulkGenerating, setBulkGenerating] = useState(false);
  const [lastGeneratedKeys, setLastGeneratedKeys] = useState<string[]>([]);
  const [lastGeneratedMeta, setLastGeneratedMeta] = useState<{ school: string; class: string } | null>(null);
  const { scopedClassIds, loading: scopeLoading } = useTeacherScope();

  // Generate form state
  const [selectedSchool, setSelectedSchool] = useState('');
  const [selectedClass, setSelectedClass] = useState('');
  const [quantity, setQuantity] = useState(10);

  // Bulk form state
  const [bulkSchool, setBulkSchool] = useState('');
  const [bulkClass, setBulkClass] = useState('');
  const [bulkQuantity, setBulkQuantity] = useState(50);

  // Filter state
  const [filterSchool, setFilterSchool] = useState('all');
  const [filterStatus, setFilterStatus] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    if (!scopeLoading) loadData();
  }, [scopeLoading]);

  const loadData = async () => {
    try {
      const [keysRes, schoolsRes, classesRes] = await Promise.all([
        supabase
          .from('registration_keys')
          .select('id, key_code, status, created_at, school:schools(name, code), class:classes(name), claimed_student:students!registration_keys_claimed_by_fkey(full_name)')
          .order('created_at', { ascending: false })
          .limit(500),
        supabase.from('schools').select('id, name, code').eq('status', 'active'),
        supabase.from('classes').select('id, name, school_id').eq('status', 'active'),
      ]);

      if (keysRes.error) throw keysRes.error;

      let allClasses = classesRes.data || [];
      if (scopedClassIds !== null) {
        allClasses = allClasses.filter(c => scopedClassIds.includes(c.id));
      }

      let allKeys = (keysRes.data || []) as unknown as (RegistrationKey & { class_id?: string })[];
      if (scopedClassIds !== null && scopedClassIds.length > 0) {
        const { data: scopedKeys, error } = await supabase
          .from('registration_keys')
          .select('id, key_code, status, created_at, class_id, school:schools(name, code), class:classes(name), claimed_student:students!registration_keys_claimed_by_fkey(full_name)')
          .in('class_id', scopedClassIds)
          .order('created_at', { ascending: false })
          .limit(500);
        if (!error) allKeys = (scopedKeys || []) as any;
      } else if (scopedClassIds !== null) {
        allKeys = [];
      }

      setKeys(allKeys as unknown as RegistrationKey[]);
      setSchools(schoolsRes.data || []);
      setClasses(allClasses);
    } catch (error) {
      console.error('Error loading keys:', error);
      toast.error('Failed to load registration keys');
    } finally {
      setLoading(false);
    }
  };

  const generateKeyCodes = (schoolObj: School, classObj: ClassItem, qty: number): string[] => {
    const schoolCode = schoolObj.code.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6);
    const classCode = classObj.name.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6);
    const existingCodes = new Set(keys.map(k => k.key_code));
    const codes: string[] = [];

    for (let i = 0; i < qty; i++) {
      let code: string;
      do {
        const rand = Math.random().toString(36).substring(2, 6).toUpperCase();
        code = `${schoolCode}-${classCode}-${rand}`;
      } while (existingCodes.has(code) || codes.includes(code));
      codes.push(code);
    }
    return codes;
  };

  const generateKeys = async () => {
    if (!selectedSchool || !selectedClass || quantity < 1) {
      toast.error('Please select a school, class, and valid quantity');
      return;
    }

    setGenerating(true);
    try {
      const school = schools.find(s => s.id === selectedSchool);
      const cls = classes.find(c => c.id === selectedClass);
      if (!school || !cls) throw new Error('Invalid selection');

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const codes = generateKeyCodes(school, cls, quantity);
      const newKeys = codes.map(code => ({
        key_code: code,
        school_id: selectedSchool,
        class_id: selectedClass,
        created_by: user.id,
        status: 'available',
      }));

      const { error } = await supabase.from('registration_keys').insert(newKeys);
      if (error) throw error;

      toast.success(`Generated ${quantity} registration keys!`);
      setDialogOpen(false);
      setSelectedSchool('');
      setSelectedClass('');
      setQuantity(10);
      loadData();
    } catch (error: any) {
      console.error('Error generating keys:', error);
      toast.error(error.message || 'Failed to generate keys');
    } finally {
      setGenerating(false);
    }
  };

  const handleBulkGenerate = async () => {
    if (!bulkSchool || !bulkClass || bulkQuantity < 1) {
      toast.error('Please select a school, class, and valid quantity');
      return;
    }

    setBulkGenerating(true);
    try {
      const school = schools.find(s => s.id === bulkSchool);
      const cls = classes.find(c => c.id === bulkClass);
      if (!school || !cls) throw new Error('Invalid selection');

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const codes = generateKeyCodes(school, cls, bulkQuantity);
      const newKeys = codes.map(code => ({
        key_code: code,
        school_id: bulkSchool,
        class_id: bulkClass,
        created_by: user.id,
        status: 'available',
      }));

      const { error } = await supabase.from('registration_keys').insert(newKeys);
      if (error) throw error;

      setLastGeneratedKeys(codes);
      setLastGeneratedMeta({ school: school.name, class: cls.name });
      toast.success(`Generated ${bulkQuantity} keys! You can now download the PDF.`);
      loadData();
    } catch (error: any) {
      console.error('Error generating bulk keys:', error);
      toast.error(error.message || 'Failed to generate keys');
    } finally {
      setBulkGenerating(false);
    }
  };

  const downloadKeysPdf = () => {
    if (!lastGeneratedKeys.length || !lastGeneratedMeta) return;

    const doc = new jsPDF();
    const { school, class: className } = lastGeneratedMeta;
    const pageWidth = doc.internal.pageSize.getWidth();
    const margin = 20;
    const colWidth = (pageWidth - margin * 2) / 3;
    let y = 0;

    const addHeader = () => {
      y = margin;
      // Title bar
      doc.setFillColor(15, 23, 42); // slate-900
      doc.rect(0, 0, pageWidth, 38, 'F');
      doc.setFillColor(20, 184, 166); // teal-500
      doc.rect(0, 36, pageWidth, 2, 'F');

      doc.setTextColor(255, 255, 255);
      doc.setFontSize(18);
      doc.setFont('helvetica', 'bold');
      doc.text('Student Registration Keys', pageWidth / 2, 16, { align: 'center' });
      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');
      doc.text(`${school}  •  ${className}  •  ${new Date().toLocaleDateString()}`, pageWidth / 2, 28, { align: 'center' });

      doc.setTextColor(0, 0, 0);
      y = 50;

      // Column headers
      doc.setFontSize(8);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(100, 100, 100);
      doc.text('#', margin, y);
      doc.text('REGISTRATION KEY', margin + 12, y);
      doc.setDrawColor(200, 200, 200);
      doc.line(margin, y + 3, pageWidth - margin, y + 3);
      y += 10;
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(0, 0, 0);
    };

    addHeader();

    // Print keys in a clean list
    doc.setFontSize(11);
    lastGeneratedKeys.forEach((code, i) => {
      if (y > 275) {
        doc.addPage();
        addHeader();
      }

      // Alternate row background
      if (i % 2 === 0) {
        doc.setFillColor(248, 250, 252);
        doc.rect(margin - 2, y - 5, pageWidth - margin * 2 + 4, 8, 'F');
      }

      doc.setFontSize(9);
      doc.setTextColor(120, 120, 120);
      doc.text(`${i + 1}.`, margin, y);
      doc.setFontSize(12);
      doc.setTextColor(15, 23, 42);
      doc.setFont('courier', 'bold');
      doc.text(code, margin + 12, y);
      doc.setFont('helvetica', 'normal');
      y += 8;
    });

    // Footer summary
    y += 5;
    if (y > 270) {
      doc.addPage();
      y = margin;
    }
    doc.setDrawColor(200, 200, 200);
    doc.line(margin, y, pageWidth - margin, y);
    y += 8;
    doc.setFontSize(9);
    doc.setTextColor(100, 100, 100);
    doc.text(`Total Keys: ${lastGeneratedKeys.length}  •  Status: Available  •  Generated on ${new Date().toLocaleString()}`, margin, y);

    doc.save(`Registration_Keys_${school.replace(/\s+/g, '_')}_${className.replace(/\s+/g, '_')}_${new Date().toISOString().slice(0, 10)}.pdf`);
    toast.success('PDF downloaded!');
  };

  const filteredClasses = classes.filter(c => c.school_id === selectedSchool);
  const bulkFilteredClasses = classes.filter(c => c.school_id === bulkSchool);

  const filteredKeys = keys.filter(k => {
    if (filterSchool !== 'all' && (k.school as any)?.code !== filterSchool) {
      const school = schools.find(s => s.id === filterSchool);
      if (school && (k.school as any)?.name !== school.name) return false;
    }
    if (filterStatus !== 'all' && k.status !== filterStatus) return false;
    if (searchQuery && !k.key_code.toLowerCase().includes(searchQuery.toLowerCase())) return false;
    return true;
  });

  if (loading) {
    return <div className="flex items-center justify-center py-12"><Loader2 className="h-6 w-6 animate-spin" /></div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap justify-between items-center gap-3">
        <div>
          <h2 className="text-2xl font-bold">Registration Keys</h2>
          <p className="text-muted-foreground">Generate and manage Student ID keys for registration</p>
        </div>
        <div className="flex gap-2">
          {/* Bulk Generate & Download */}
          <Dialog open={bulkDialogOpen} onOpenChange={(open) => {
            setBulkDialogOpen(open);
            if (!open) {
              setLastGeneratedKeys([]);
              setLastGeneratedMeta(null);
            }
          }}>
            <DialogTrigger asChild>
              <Button variant="outline" className="border-primary/30 text-primary hover:bg-primary/10">
                <FileText className="mr-2 h-4 w-4" />
                Bulk Generate & PDF
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <FileText className="h-5 w-5 text-primary" />
                  Bulk Generate & Download PDF
                </DialogTitle>
                <DialogDescription>
                  Generate a large batch of keys and download them as a professional PDF document.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>School</Label>
                  <Select value={bulkSchool} onValueChange={(v) => { setBulkSchool(v); setBulkClass(''); setLastGeneratedKeys([]); }}>
                    <SelectTrigger><SelectValue placeholder="Select school" /></SelectTrigger>
                    <SelectContent>
                      {schools.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Class</Label>
                  <Select value={bulkClass} onValueChange={(v) => { setBulkClass(v); setLastGeneratedKeys([]); }} disabled={!bulkSchool}>
                    <SelectTrigger><SelectValue placeholder="Select class" /></SelectTrigger>
                    <SelectContent>
                      {bulkFilteredClasses.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Quantity (up to 500)</Label>
                  <Input type="number" min={1} max={500} value={bulkQuantity} onChange={e => { setBulkQuantity(parseInt(e.target.value) || 1); setLastGeneratedKeys([]); }} />
                </div>

                {lastGeneratedKeys.length === 0 ? (
                  <Button className="w-full" onClick={handleBulkGenerate} disabled={bulkGenerating}>
                    {bulkGenerating ? (
                      <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Generating {bulkQuantity} Keys...</>
                    ) : (
                      <><Key className="mr-2 h-4 w-4" />Generate {bulkQuantity} Keys</>
                    )}
                  </Button>
                ) : (
                  <div className="space-y-3">
                    <div className="rounded-lg border border-green-200 bg-green-50 dark:bg-green-950/30 dark:border-green-800 p-4 text-center">
                      <p className="text-sm font-semibold text-green-700 dark:text-green-400">
                        ✅ {lastGeneratedKeys.length} keys generated successfully!
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">Click below to download as PDF</p>
                    </div>
                    <Button className="w-full gap-2" onClick={downloadKeysPdf} variant="default">
                      <Download className="h-4 w-4" />
                      Download PDF ({lastGeneratedKeys.length} keys)
                    </Button>
                    <Button className="w-full" variant="outline" onClick={() => { setLastGeneratedKeys([]); setLastGeneratedMeta(null); }}>
                      Generate More
                    </Button>
                  </div>
                )}
              </div>
            </DialogContent>
          </Dialog>

          {/* Standard Generate */}
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button><Plus className="mr-2 h-4 w-4" />Generate Keys</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Generate Registration Keys</DialogTitle>
                <DialogDescription>Create a batch of Student ID keys for a specific school and class</DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>School</Label>
                  <Select value={selectedSchool} onValueChange={(v) => { setSelectedSchool(v); setSelectedClass(''); }}>
                    <SelectTrigger><SelectValue placeholder="Select school" /></SelectTrigger>
                    <SelectContent>
                      {schools.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Class</Label>
                  <Select value={selectedClass} onValueChange={setSelectedClass} disabled={!selectedSchool}>
                    <SelectTrigger><SelectValue placeholder="Select class" /></SelectTrigger>
                    <SelectContent>
                      {filteredClasses.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Quantity</Label>
                  <Input type="number" min={1} max={100} value={quantity} onChange={e => setQuantity(parseInt(e.target.value) || 1)} />
                </div>
                <Button className="w-full" onClick={generateKeys} disabled={generating}>
                  {generating ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Generating...</> : <><Key className="mr-2 h-4 w-4" />Generate {quantity} Keys</>}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm font-medium">Total Keys</CardTitle></CardHeader>
          <CardContent><div className="text-2xl font-bold">{keys.length}</div></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-green-600">Available</CardTitle></CardHeader>
          <CardContent><div className="text-2xl font-bold text-green-600">{keys.filter(k => k.status === 'available').length}</div></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-orange-600">Claimed</CardTitle></CardHeader>
          <CardContent><div className="text-2xl font-bold text-orange-600">{keys.filter(k => k.status === 'claimed').length}</div></CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search by key code..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} className="pl-9" />
        </div>
        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="w-[150px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="available">Available</SelectItem>
            <SelectItem value="claimed">Claimed</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Keys Table */}
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Key Code</TableHead>
                <TableHead>School</TableHead>
                <TableHead>Class</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Claimed By</TableHead>
                <TableHead>Created</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredKeys.length === 0 ? (
                <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">No registration keys found</TableCell></TableRow>
              ) : (
                filteredKeys.map(k => (
                  <TableRow key={k.id}>
                    <TableCell className="font-mono font-medium">{k.key_code}</TableCell>
                    <TableCell>{(k.school as any)?.name || '—'}</TableCell>
                    <TableCell>{(k.class as any)?.name || '—'}</TableCell>
                    <TableCell>
                      <Badge variant={k.status === 'available' ? 'default' : 'secondary'}>
                        {k.status === 'available' ? 'Available' : 'Claimed'}
                      </Badge>
                    </TableCell>
                    <TableCell>{(k.claimed_student as any)?.full_name || '—'}</TableCell>
                    <TableCell className="text-muted-foreground text-sm">{new Date(k.created_at).toLocaleDateString()}</TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
