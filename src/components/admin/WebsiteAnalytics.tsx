import { useEffect, useState, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { BarChart, Bar, LineChart, Line, PieChart, Pie, Cell, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { Eye, Users, Clock, TrendingUp, Monitor, Smartphone, Tablet, Globe, ArrowUp, ArrowDown, Activity, MousePointerClick, RefreshCw } from 'lucide-react';
import { format, subDays, startOfDay, eachDayOfInterval, eachHourOfInterval, startOfHour, subHours } from 'date-fns';

interface PageView {
  id: string;
  session_id: string;
  user_id: string | null;
  page_path: string;
  page_title: string | null;
  device_type: string | null;
  browser: string | null;
  os: string | null;
  duration_seconds: number | null;
  created_at: string;
  event_type: string;
}

const COLORS = [
  'hsl(var(--primary))',
  'hsl(var(--chart-2, 160 60% 45%))',
  'hsl(var(--chart-3, 30 80% 55%))',
  'hsl(var(--chart-4, 280 65% 60%))',
  'hsl(var(--chart-5, 340 75% 55%))',
];

const PAGE_LABELS: Record<string, string> = {
  '/': 'Home',
  '/auth': 'Login / Signup',
  '/dashboard': 'Student Dashboard',
  '/admin': 'Admin Dashboard',
  '/parent': 'Parent Dashboard',
  '/admin-setup': 'Admin Setup',
};

export default function WebsiteAnalytics() {
  const [views, setViews] = useState<PageView[]>([]);
  const [loading, setLoading] = useState(true);
  const [range, setRange] = useState('7');
  const [refreshing, setRefreshing] = useState(false);

  const fetchData = async () => {
    setRefreshing(true);
    try {
      const since = subDays(new Date(), parseInt(range)).toISOString();
      const { data, error } = await supabase
        .from('page_views')
        .select('*')
        .gte('created_at', since)
        .order('created_at', { ascending: true })
        .limit(1000);

      if (error) throw error;
      setViews((data as PageView[]) || []);
    } catch (err) {
      console.error('Analytics fetch error:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => { fetchData(); }, [range]);

  // ---- Computed Metrics ----
  const stats = useMemo(() => {
    const totalViews = views.length;
    const uniqueSessions = new Set(views.map(v => v.session_id)).size;
    const avgDuration = views.filter(v => v.duration_seconds && v.duration_seconds > 0);
    const avgSec = avgDuration.length > 0
      ? Math.round(avgDuration.reduce((s, v) => s + (v.duration_seconds || 0), 0) / avgDuration.length)
      : 0;
    const bounceRate = totalViews > 0
      ? Math.round((views.filter(v => (v.duration_seconds || 0) < 5).length / totalViews) * 100)
      : 0;

    return { totalViews, uniqueSessions, avgSec, bounceRate };
  }, [views]);

  // Traffic over time
  const trafficData = useMemo(() => {
    const days = parseInt(range);
    if (days <= 1) {
      const hours = eachHourOfInterval({ start: subHours(new Date(), 24), end: new Date() });
      return hours.map(hour => {
        const hourStart = startOfHour(hour);
        const hourEnd = new Date(hourStart.getTime() + 3600000);
        const hourViews = views.filter(v => {
          const t = new Date(v.created_at);
          return t >= hourStart && t < hourEnd;
        });
        return {
          label: format(hour, 'HH:mm'),
          views: hourViews.length,
          visitors: new Set(hourViews.map(v => v.session_id)).size,
        };
      });
    }
    const interval = eachDayOfInterval({ start: subDays(new Date(), days), end: new Date() });
    return interval.map(day => {
      const dayStart = startOfDay(day);
      const dayEnd = new Date(dayStart.getTime() + 86400000);
      const dayViews = views.filter(v => {
        const t = new Date(v.created_at);
        return t >= dayStart && t < dayEnd;
      });
      return {
        label: format(day, 'MMM dd'),
        views: dayViews.length,
        visitors: new Set(dayViews.map(v => v.session_id)).size,
      };
    });
  }, [views, range]);

  // Top pages
  const topPages = useMemo(() => {
    const counts: Record<string, number> = {};
    views.forEach(v => { counts[v.page_path] = (counts[v.page_path] || 0) + 1; });
    return Object.entries(counts)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 8)
      .map(([path, count]) => ({
        path,
        label: PAGE_LABELS[path] || path,
        count,
        pct: stats.totalViews > 0 ? Math.round((count / stats.totalViews) * 100) : 0,
      }));
  }, [views, stats.totalViews]);

  // Device breakdown
  const deviceData = useMemo(() => {
    const counts: Record<string, number> = {};
    views.forEach(v => { counts[v.device_type || 'desktop'] = (counts[v.device_type || 'desktop'] || 0) + 1; });
    return Object.entries(counts).map(([name, value]) => ({ name, value }));
  }, [views]);

  // Browser breakdown
  const browserData = useMemo(() => {
    const counts: Record<string, number> = {};
    views.forEach(v => { counts[v.browser || 'Other'] = (counts[v.browser || 'Other'] || 0) + 1; });
    return Object.entries(counts)
      .sort(([, a], [, b]) => b - a)
      .map(([name, value]) => ({ name, value }));
  }, [views]);

  // OS breakdown
  const osData = useMemo(() => {
    const counts: Record<string, number> = {};
    views.forEach(v => { counts[v.os || 'Other'] = (counts[v.os || 'Other'] || 0) + 1; });
    return Object.entries(counts)
      .sort(([, a], [, b]) => b - a)
      .map(([name, value]) => ({ name, value }));
  }, [views]);

  const DeviceIcon = ({ type }: { type: string }) => {
    if (type === 'mobile') return <Smartphone className="h-4 w-4" />;
    if (type === 'tablet') return <Tablet className="h-4 w-4" />;
    return <Monitor className="h-4 w-4" />;
  };

  if (loading) {
    return (
      <div className="space-y-6 animate-pulse">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[1,2,3,4].map(i => (
            <Card key={i}><CardContent className="p-6"><div className="h-16 bg-muted rounded" /></CardContent></Card>
          ))}
        </div>
        <Card><CardContent className="p-6"><div className="h-64 bg-muted rounded" /></CardContent></Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <Activity className="h-6 w-6 text-primary" />
            Website Analytics
          </h2>
          <p className="text-muted-foreground text-sm mt-1">
            Real-time traffic and user behavior insights
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Select value={range} onValueChange={setRange}>
            <SelectTrigger className="w-[140px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="1">Last 24 hours</SelectItem>
              <SelectItem value="7">Last 7 days</SelectItem>
              <SelectItem value="30">Last 30 days</SelectItem>
              <SelectItem value="90">Last 90 days</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" size="icon" onClick={fetchData} disabled={refreshing}>
            <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-br from-primary/10 to-transparent" />
          <CardContent className="p-6 relative">
            <div className="flex items-center justify-between">
              <Eye className="h-8 w-8 text-primary opacity-80" />
              <Badge variant="secondary" className="text-xs">
                <ArrowUp className="h-3 w-3 mr-1" /> Live
              </Badge>
            </div>
            <div className="mt-3">
              <p className="text-3xl font-bold">{stats.totalViews.toLocaleString()}</p>
              <p className="text-sm text-muted-foreground">Total Page Views</p>
            </div>
          </CardContent>
        </Card>

        <Card className="relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-br from-green-500/10 to-transparent" />
          <CardContent className="p-6 relative">
            <div className="flex items-center justify-between">
              <Users className="h-8 w-8 text-green-500 opacity-80" />
              <Badge variant="secondary" className="text-xs">Sessions</Badge>
            </div>
            <div className="mt-3">
              <p className="text-3xl font-bold">{stats.uniqueSessions.toLocaleString()}</p>
              <p className="text-sm text-muted-foreground">Unique Visitors</p>
            </div>
          </CardContent>
        </Card>

        <Card className="relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-br from-orange-500/10 to-transparent" />
          <CardContent className="p-6 relative">
            <div className="flex items-center justify-between">
              <Clock className="h-8 w-8 text-orange-500 opacity-80" />
              <Badge variant="secondary" className="text-xs">Avg</Badge>
            </div>
            <div className="mt-3">
              <p className="text-3xl font-bold">
                {stats.avgSec > 60 ? `${Math.floor(stats.avgSec / 60)}m ${stats.avgSec % 60}s` : `${stats.avgSec}s`}
              </p>
              <p className="text-sm text-muted-foreground">Avg. Duration</p>
            </div>
          </CardContent>
        </Card>

        <Card className="relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-br from-red-500/10 to-transparent" />
          <CardContent className="p-6 relative">
            <div className="flex items-center justify-between">
              <MousePointerClick className="h-8 w-8 text-red-500 opacity-80" />
              <Badge variant={stats.bounceRate > 50 ? "destructive" : "secondary"} className="text-xs">
                {stats.bounceRate > 50 ? <ArrowUp className="h-3 w-3 mr-1" /> : <ArrowDown className="h-3 w-3 mr-1" />}
                {stats.bounceRate}%
              </Badge>
            </div>
            <div className="mt-3">
              <p className="text-3xl font-bold">{stats.bounceRate}%</p>
              <p className="text-sm text-muted-foreground">Bounce Rate</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Traffic Trend Chart */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-primary" />
            Traffic Overview
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={320}>
            <AreaChart data={trafficData}>
              <defs>
                <linearGradient id="viewsGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="visitorsGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="hsl(160, 60%, 45%)" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="hsl(160, 60%, 45%)" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
              <XAxis dataKey="label" tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 12 }} />
              <Tooltip contentStyle={{ borderRadius: '8px', border: '1px solid hsl(var(--border))' }} />
              <Legend />
              <Area type="monotone" dataKey="views" name="Page Views" stroke="hsl(var(--primary))" fill="url(#viewsGradient)" strokeWidth={2} />
              <Area type="monotone" dataKey="visitors" name="Visitors" stroke="hsl(160, 60%, 45%)" fill="url(#visitorsGradient)" strokeWidth={2} />
            </AreaChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Bottom Row: Pages + Device/Browser/OS */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Top Pages */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Globe className="h-5 w-5 text-primary" />
              Top Pages
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {topPages.length === 0 && (
                <p className="text-muted-foreground text-sm text-center py-8">No page view data yet</p>
              )}
              {topPages.map((page, i) => (
                <div key={page.path} className="flex items-center gap-3">
                  <span className="text-xs text-muted-foreground w-5 font-mono">{i + 1}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{page.label}</p>
                    <p className="text-xs text-muted-foreground truncate">{page.path}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-24 h-2 bg-muted rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full bg-primary transition-all duration-500"
                        style={{ width: `${page.pct}%` }}
                      />
                    </div>
                    <span className="text-sm font-semibold w-12 text-right">{page.count}</span>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Device & Browser & OS */}
        <div className="space-y-6">
          {/* Device Pie */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <Monitor className="h-4 w-4 text-primary" />
                Devices
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-6">
                <ResponsiveContainer width={120} height={120}>
                  <PieChart>
                    <Pie data={deviceData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={50} strokeWidth={2}>
                      {deviceData.map((_, i) => (
                        <Cell key={i} fill={COLORS[i % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
                <div className="flex-1 space-y-2">
                  {deviceData.map((d, i) => (
                    <div key={d.name} className="flex items-center gap-2 text-sm">
                      <div className="w-3 h-3 rounded-full" style={{ backgroundColor: COLORS[i % COLORS.length] }} />
                      <DeviceIcon type={d.name} />
                      <span className="capitalize">{d.name}</span>
                      <span className="ml-auto font-semibold">{d.value}</span>
                    </div>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Browser Bar */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Browsers & OS</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={160}>
                <BarChart data={browserData} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                  <XAxis type="number" tick={{ fontSize: 11 }} />
                  <YAxis type="category" dataKey="name" tick={{ fontSize: 11 }} width={60} />
                  <Tooltip />
                  <Bar dataKey="value" name="Views" radius={[0, 4, 4, 0]} fill="hsl(var(--primary))" />
                </BarChart>
              </ResponsiveContainer>
              <div className="mt-4 flex flex-wrap gap-2">
                {osData.map((o, i) => (
                  <Badge key={o.name} variant="outline" className="text-xs">
                    {o.name}: {o.value}
                  </Badge>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
