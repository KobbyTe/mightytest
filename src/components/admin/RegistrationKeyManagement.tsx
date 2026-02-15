import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Plus, Key, Loader2, Search } from 'lucide-react';
import { toast } from 'sonner';

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

  // Generate form state
  const [selectedSchool, setSelectedSchool] = useState('');
  const [selectedClass, setSelectedClass] = useState('');
  const [quantity, setQuantity] = useState(10);

  // Filter state
  const [filterSchool, setFilterSchool] = useState('all');
  const [filterStatus, setFilterStatus] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    loadData();
  }, []);

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
      setKeys((keysRes.data || []) as unknown as RegistrationKey[]);
      setSchools(schoolsRes.data || []);
      setClasses(classesRes.data || []);
    } catch (error) {
      console.error('Error loading keys:', error);
      toast.error('Failed to load registration keys');
    } finally {
      setLoading(false);
    }
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

      const schoolCode = school.code.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6);
      const classCode = cls.name.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6);

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const newKeys: { key_code: string; school_id: string; class_id: string; created_by: string; status: string }[] = [];
      const existingCodes = new Set(keys.map(k => k.key_code));

      for (let i = 0; i < quantity; i++) {
        let code: string;
        do {
          const rand = Math.random().toString(36).substring(2, 6).toUpperCase();
          code = `${schoolCode}-${classCode}-${rand}`;
        } while (existingCodes.has(code));
        existingCodes.add(code);
        newKeys.push({
          key_code: code,
          school_id: selectedSchool,
          class_id: selectedClass,
          created_by: user.id,
          status: 'available',
        });
      }

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

  const filteredClasses = classes.filter(c => c.school_id === selectedSchool);

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
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold">Registration Keys</h2>
          <p className="text-muted-foreground">Generate and manage Student ID keys for registration</p>
        </div>
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
