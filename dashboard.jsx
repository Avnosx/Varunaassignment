import React, { useState, useEffect } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { Ship, TrendingDown, Droplet, Users, CheckCircle, XCircle, AlertCircle } from 'lucide-react';

// Mock API client (replace with actual API calls)
const api = {
  getRoutes: async () => [
    { routeId: 'R001', vesselType: 'Container', fuelType: 'HFO', year: 2024, ghgIntensity: 91.0, fuelConsumption: 5000, distance: 12000, totalEmissions: 4500, isBaseline: false },
    { routeId: 'R002', vesselType: 'BulkCarrier', fuelType: 'LNG', year: 2024, ghgIntensity: 88.0, fuelConsumption: 4800, distance: 11500, totalEmissions: 4200, isBaseline: true },
    { routeId: 'R003', vesselType: 'Tanker', fuelType: 'MGO', year: 2024, ghgIntensity: 93.5, fuelConsumption: 5100, distance: 12500, totalEmissions: 4700, isBaseline: false },
    { routeId: 'R004', vesselType: 'RoRo', fuelType: 'HFO', year: 2025, ghgIntensity: 89.2, fuelConsumption: 4900, distance: 11800, totalEmissions: 4300, isBaseline: false },
    { routeId: 'R005', vesselType: 'Container', fuelType: 'LNG', year: 2025, ghgIntensity: 90.5, fuelConsumption: 4950, distance: 11900, totalEmissions: 4400, isBaseline: false }
  ],
  setBaseline: async (routeId) => ({ success: true, routeId }),
  getComparison: async () => ({
    baseline: { routeId: 'R002', ghgIntensity: 88.0 },
    comparisons: [
      { routeId: 'R001', ghgIntensity: 91.0, percentDiff: 3.41, compliant: false },
      { routeId: 'R003', ghgIntensity: 93.5, percentDiff: 6.25, compliant: false },
      { routeId: 'R004', ghgIntensity: 89.2, percentDiff: 1.36, compliant: false },
      { routeId: 'R005', ghgIntensity: 90.5, percentDiff: 2.84, compliant: false }
    ]
  }),
  getCB: async (year) => ({ year, cbBefore: 1250.5, banked: 500, cbAfter: 750.5 }),
  bankCB: async (amount) => ({ success: true, banked: amount }),
  applyBanked: async (amount) => ({ success: true, applied: amount }),
  getAdjustedCB: async (year) => [
    { shipId: 'S001', cbBefore: 1250.5, cbAfter: 1250.5 },
    { shipId: 'S002', cbBefore: -800.0, cbAfter: -800.0 },
    { shipId: 'S003', cbBefore: 500.0, cbAfter: 500.0 }
  ],
  createPool: async (members) => ({ success: true, poolId: 'P001', members })
};

const TARGET_INTENSITY = 89.3368;

function App() {
  const [activeTab, setActiveTab] = useState('routes');
  const [routes, setRoutes] = useState([]);
  const [comparison, setComparison] = useState(null);
  const [cbData, setCbData] = useState(null);
  const [adjustedCB, setAdjustedCB] = useState([]);
  const [filters, setFilters] = useState({ vesselType: '', fuelType: '', year: '' });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadRoutes();
  }, []);

  const loadRoutes = async () => {
    setLoading(true);
    const data = await api.getRoutes();
    setRoutes(data);
    setLoading(false);
  };

  const loadComparison = async () => {
    setLoading(true);
    const data = await api.getComparison();
    setComparison(data);
    setLoading(false);
  };

  const loadCB = async (year) => {
    setLoading(true);
    const data = await api.getCB(year);
    setCbData(data);
    setLoading(false);
  };

  const loadAdjustedCB = async (year) => {
    setLoading(true);
    const data = await api.getAdjustedCB(year);
    setAdjustedCB(data);
    setLoading(false);
  };

  const handleSetBaseline = async (routeId) => {
    await api.setBaseline(routeId);
    loadRoutes();
  };

  const handleBankCB = async (amount) => {
    if (cbData.cbBefore <= 0) {
      alert('Cannot bank negative or zero CB');
      return;
    }
    await api.bankCB(amount);
    loadCB(cbData.year);
  };

  const handleApplyBanked = async (amount) => {
    if (amount > cbData.banked) {
      alert('Cannot apply more than banked amount');
      return;
    }
    await api.applyBanked(amount);
    loadCB(cbData.year);
  };

  const handleCreatePool = async (selectedMembers) => {
    const totalCB = selectedMembers.reduce((sum, m) => sum + m.cbBefore, 0);
    if (totalCB < 0) {
      alert('Pool total CB must be non-negative');
      return;
    }
    await api.createPool(selectedMembers);
    loadAdjustedCB(2024);
  };

  const filteredRoutes = routes.filter(r => 
    (!filters.vesselType || r.vesselType === filters.vesselType) &&
    (!filters.fuelType || r.fuelType === filters.fuelType) &&
    (!filters.year || r.year.toString() === filters.year)
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      <div className="container mx-auto px-4 py-8">
        <header className="mb-8">
          <h1 className="text-4xl font-bold text-indigo-900 flex items-center gap-3">
            <Ship className="w-10 h-10" />
            FuelEU Maritime Compliance Dashboard
          </h1>
          <p className="text-indigo-600 mt-2">Monitor routes, compliance, banking & pooling</p>
        </header>

        <div className="bg-white rounded-lg shadow-lg overflow-hidden">
          <nav className="flex border-b">
            {['routes', 'compare', 'banking', 'pooling'].map(tab => (
              <button
                key={tab}
                onClick={() => {
                  setActiveTab(tab);
                  if (tab === 'compare' && !comparison) loadComparison();
                  if (tab === 'banking' && !cbData) loadCB(2024);
                  if (tab === 'pooling' && adjustedCB.length === 0) loadAdjustedCB(2024);
                }}
                className={`flex-1 px-6 py-4 font-semibold capitalize transition-colors ${
                  activeTab === tab
                    ? 'bg-indigo-600 text-white'
                    : 'bg-gray-50 text-gray-700 hover:bg-gray-100'
                }`}
              >
                {tab === 'routes' && <Ship className="inline w-5 h-5 mr-2" />}
                {tab === 'compare' && <TrendingDown className="inline w-5 h-5 mr-2" />}
                {tab === 'banking' && <Droplet className="inline w-5 h-5 mr-2" />}
                {tab === 'pooling' && <Users className="inline w-5 h-5 mr-2" />}
                {tab}
              </button>
            ))}
          </nav>

          <div className="p-6">
            {activeTab === 'routes' && (
              <RoutesTab
                routes={filteredRoutes}
                filters={filters}
                setFilters={setFilters}
                onSetBaseline={handleSetBaseline}
                loading={loading}
              />
            )}
            {activeTab === 'compare' && comparison && (
              <CompareTab comparison={comparison} target={TARGET_INTENSITY} />
            )}
            {activeTab === 'banking' && cbData && (
              <BankingTab
                cbData={cbData}
                onBank={handleBankCB}
                onApply={handleApplyBanked}
              />
            )}
            {activeTab === 'pooling' && adjustedCB.length > 0 && (
              <PoolingTab
                adjustedCB={adjustedCB}
                onCreatePool={handleCreatePool}
              />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function RoutesTab({ routes, filters, setFilters, onSetBaseline, loading }) {
  return (
    <div>
      <div className="mb-6 grid grid-cols-1 md:grid-cols-3 gap-4">
        <select
          value={filters.vesselType}
          onChange={(e) => setFilters({ ...filters, vesselType: e.target.value })}
          className="px-4 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500"
        >
          <option value="">All Vessel Types</option>
          <option value="Container">Container</option>
          <option value="BulkCarrier">Bulk Carrier</option>
          <option value="Tanker">Tanker</option>
          <option value="RoRo">RoRo</option>
        </select>
        <select
          value={filters.fuelType}
          onChange={(e) => setFilters({ ...filters, fuelType: e.target.value })}
          className="px-4 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500"
        >
          <option value="">All Fuel Types</option>
          <option value="HFO">HFO</option>
          <option value="LNG">LNG</option>
          <option value="MGO">MGO</option>
        </select>
        <select
          value={filters.year}
          onChange={(e) => setFilters({ ...filters, year: e.target.value })}
          className="px-4 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500"
        >
          <option value="">All Years</option>
          <option value="2024">2024</option>
          <option value="2025">2025</option>
        </select>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-indigo-50">
            <tr>
              <th className="px-4 py-3 text-left text-sm font-semibold text-indigo-900">Route ID</th>
              <th className="px-4 py-3 text-left text-sm font-semibold text-indigo-900">Vessel Type</th>
              <th className="px-4 py-3 text-left text-sm font-semibold text-indigo-900">Fuel Type</th>
              <th className="px-4 py-3 text-left text-sm font-semibold text-indigo-900">Year</th>
              <th className="px-4 py-3 text-right text-sm font-semibold text-indigo-900">GHG Intensity</th>
              <th className="px-4 py-3 text-right text-sm font-semibold text-indigo-900">Fuel (t)</th>
              <th className="px-4 py-3 text-right text-sm font-semibold text-indigo-900">Distance (km)</th>
              <th className="px-4 py-3 text-right text-sm font-semibold text-indigo-900">Emissions (t)</th>
              <th className="px-4 py-3 text-center text-sm font-semibold text-indigo-900">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {routes.map(route => (
              <tr key={route.routeId} className={route.isBaseline ? 'bg-green-50' : 'hover:bg-gray-50'}>
                <td className="px-4 py-3 text-sm font-medium">{route.routeId}</td>
                <td className="px-4 py-3 text-sm">{route.vesselType}</td>
                <td className="px-4 py-3 text-sm">{route.fuelType}</td>
                <td className="px-4 py-3 text-sm">{route.year}</td>
                <td className="px-4 py-3 text-sm text-right">{route.ghgIntensity.toFixed(2)}</td>
                <td className="px-4 py-3 text-sm text-right">{route.fuelConsumption.toLocaleString()}</td>
                <td className="px-4 py-3 text-sm text-right">{route.distance.toLocaleString()}</td>
                <td className="px-4 py-3 text-sm text-right">{route.totalEmissions.toLocaleString()}</td>
                <td className="px-4 py-3 text-center">
                  {route.isBaseline ? (
                    <span className="text-green-600 font-semibold text-sm">Baseline</span>
                  ) : (
                    <button
                      onClick={() => onSetBaseline(route.routeId)}
                      className="px-3 py-1 bg-indigo-600 text-white rounded hover:bg-indigo-700 text-sm"
                    >
                      Set Baseline
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function CompareTab({ comparison, target }) {
  const chartData = comparison.comparisons.map(c => ({
    name: c.routeId,
    baseline: comparison.baseline.ghgIntensity,
    route: c.ghgIntensity,
    target
  }));

  return (
    <div>
      <div className="mb-6 p-4 bg-blue-50 rounded-lg">
        <p className="text-sm text-blue-900">
          <strong>Baseline:</strong> {comparison.baseline.routeId} ({comparison.baseline.ghgIntensity.toFixed(2)} gCO₂e/MJ)
          <br />
          <strong>Target Intensity:</strong> {target.toFixed(4)} gCO₂e/MJ (2% below 91.16)
        </p>
      </div>

      <div className="mb-8">
        <h3 className="text-lg font-semibold mb-4">Comparison Chart</h3>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="name" />
            <YAxis label={{ value: 'gCO₂e/MJ', angle: -90, position: 'insideLeft' }} />
            <Tooltip />
            <Legend />
            <Bar dataKey="baseline" fill="#10b981" name="Baseline" />
            <Bar dataKey="route" fill="#6366f1" name="Route" />
            <Bar dataKey="target" fill="#ef4444" name="Target" />
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-indigo-50">
            <tr>
              <th className="px-4 py-3 text-left text-sm font-semibold">Route ID</th>
              <th className="px-4 py-3 text-right text-sm font-semibold">GHG Intensity</th>
              <th className="px-4 py-3 text-right text-sm font-semibold">% Difference</th>
              <th className="px-4 py-3 text-center text-sm font-semibold">Compliant</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {comparison.comparisons.map(c => (
              <tr key={c.routeId} className="hover:bg-gray-50">
                <td className="px-4 py-3 text-sm font-medium">{c.routeId}</td>
                <td className="px-4 py-3 text-sm text-right">{c.ghgIntensity.toFixed(2)}</td>
                <td className="px-4 py-3 text-sm text-right">
                  <span className={c.percentDiff > 0 ? 'text-red-600' : 'text-green-600'}>
                    {c.percentDiff > 0 ? '+' : ''}{c.percentDiff.toFixed(2)}%
                  </span>
                </td>
                <td className="px-4 py-3 text-center">
                  {c.compliant ? (
                    <CheckCircle className="inline w-5 h-5 text-green-600" />
                  ) : (
                    <XCircle className="inline w-5 h-5 text-red-600" />
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function BankingTab({ cbData, onBank, onApply }) {
  const [bankAmount, setBankAmount] = useState('');
  const [applyAmount, setApplyAmount] = useState('');

  return (
    <div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <div className="p-6 bg-blue-50 rounded-lg">
          <h3 className="text-sm font-semibold text-blue-900 mb-2">CB Before</h3>
          <p className="text-3xl font-bold text-blue-700">{cbData.cbBefore.toFixed(2)}</p>
          <p className="text-sm text-blue-600 mt-1">tCO₂eq</p>
        </div>
        <div className="p-6 bg-purple-50 rounded-lg">
          <h3 className="text-sm font-semibold text-purple-900 mb-2">Banked</h3>
          <p className="text-3xl font-bold text-purple-700">{cbData.banked.toFixed(2)}</p>
          <p className="text-sm text-purple-600 mt-1">tCO₂eq</p>
        </div>
        <div className="p-6 bg-green-50 rounded-lg">
          <h3 className="text-sm font-semibold text-green-900 mb-2">CB After</h3>
          <p className="text-3xl font-bold text-green-700">{cbData.cbAfter.toFixed(2)}</p>
          <p className="text-sm text-green-600 mt-1">tCO₂eq</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="p-6 border rounded-lg">
          <h3 className="text-lg font-semibold mb-4">Bank Surplus</h3>
          <p className="text-sm text-gray-600 mb-4">Bank positive CB for future use</p>
          <input
            type="number"
            value={bankAmount}
            onChange={(e) => setBankAmount(e.target.value)}
            placeholder="Amount to bank"
            className="w-full px-4 py-2 border rounded-lg mb-4 focus:ring-2 focus:ring-indigo-500"
            disabled={cbData.cbBefore <= 0}
          />
          <button
            onClick={() => {
              onBank(parseFloat(bankAmount));
              setBankAmount('');
            }}
            disabled={cbData.cbBefore <= 0 || !bankAmount}
            className="w-full px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:bg-gray-300 disabled:cursor-not-allowed"
          >
            Bank Amount
          </button>
          {cbData.cbBefore <= 0 && (
            <p className="text-sm text-red-600 mt-2 flex items-center gap-2">
              <AlertCircle className="w-4 h-4" />
              Cannot bank negative or zero CB
            </p>
          )}
        </div>

        <div className="p-6 border rounded-lg">
          <h3 className="text-lg font-semibold mb-4">Apply Banked</h3>
          <p className="text-sm text-gray-600 mb-4">Use banked surplus to cover deficit</p>
          <input
            type="number"
            value={applyAmount}
            onChange={(e) => setApplyAmount(e.target.value)}
            placeholder="Amount to apply"
            className="w-full px-4 py-2 border rounded-lg mb-4 focus:ring-2 focus:ring-indigo-500"
            disabled={cbData.banked <= 0}
          />
          <button
            onClick={() => {
              onApply(parseFloat(applyAmount));
              setApplyAmount('');
            }}
            disabled={cbData.banked <= 0 || !applyAmount || parseFloat(applyAmount) > cbData.banked}
            className="w-full px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:bg-gray-300 disabled:cursor-not-allowed"
          >
            Apply Amount
          </button>
          {cbData.banked <= 0 && (
            <p className="text-sm text-red-600 mt-2 flex items-center gap-2">
              <AlertCircle className="w-4 h-4" />
              No banked surplus available
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

function PoolingTab({ adjustedCB, onCreatePool }) {
  const [selectedMembers, setSelectedMembers] = useState([]);

  const toggleMember = (member) => {
    setSelectedMembers(prev =>
      prev.find(m => m.shipId === member.shipId)
        ? prev.filter(m => m.shipId !== member.shipId)
        : [...prev, member]
    );
  };

  const totalCB = selectedMembers.reduce((sum, m) => sum + m.cbBefore, 0);
  const isValid = totalCB >= 0 && selectedMembers.length >= 2;

  return (
    <div>
      <div className="mb-6 p-4 bg-blue-50 rounded-lg">
        <h3 className="font-semibold text-blue-900 mb-2">Pool Validation</h3>
        <div className="flex items-center gap-4">
          <p className="text-sm">
            <strong>Selected Members:</strong> {selectedMembers.length}
          </p>
          <p className="text-sm">
            <strong>Total CB:</strong>
            <span className={totalCB >= 0 ? 'text-green-600 ml-2' : 'text-red-600 ml-2'}>
              {totalCB.toFixed(2)} tCO₂eq
            </span>
          </p>
          <div className="ml-auto">
            {isValid ? (
              <CheckCircle className="w-6 h-6 text-green-600" />
            ) : (
              <XCircle className="w-6 h-6 text-red-600" />
            )}
          </div>
        </div>
      </div>

      <div className="overflow-x-auto mb-6">
        <table className="w-full">
          <thead className="bg-indigo-50">
            <tr>
              <th className="px-4 py-3 text-left text-sm font-semibold">Select</th>
              <th className="px-4 py-3 text-left text-sm font-semibold">Ship ID</th>
              <th className="px-4 py-3 text-right text-sm font-semibold">CB Before</th>
              <th className="px-4 py-3 text-right text-sm font-semibold">CB After</th>
              <th className="px-4 py-3 text-center text-sm font-semibold">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {adjustedCB.map(ship => (
              <tr key={ship.shipId} className="hover:bg-gray-50">
                <td className="px-4 py-3">
                  <input
                    type="checkbox"
                    checked={selectedMembers.find(m => m.shipId === ship.shipId)}
                    onChange={() => toggleMember(ship)}
                    className="w-4 h-4 text-indigo-600 rounded focus:ring-2 focus:ring-indigo-500"
                  />
                </td>
                <td className="px-4 py-3 text-sm font-medium">{ship.shipId}</td>
                <td className="px-4 py-3 text-sm text-right">
                  <span className={ship.cbBefore >= 0 ? 'text-green-600' : 'text-red-600'}>
                    {ship.cbBefore.toFixed(2)}
                  </span>
                </td>
                <td className="px-4 py-3 text-sm text-right">{ship.cbAfter.toFixed(2)}</td>
                <td className="px-4 py-3 text-center">
                  {ship.cbBefore >= 0 ? (
                    <span className="px-2 py-1 bg-green-100 text-green-800 rounded text-xs">Surplus</span>
                  ) : (
                    <span className="px-2 py-1 bg-red-100 text-red-800 rounded text-xs">Deficit</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <button
        onClick={() => onCreatePool(selectedMembers)}
        disabled={!isValid}
        className="w-full px-6 py-3 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:bg-gray-300 disabled:cursor-not-allowed font-semibold"
      >
        Create Pool
      </button>

      {!isValid && selectedMembers.length > 0 && (
        <p className="text-sm text-red-600 mt-4 flex items-center gap-2">
          <AlertCircle className="w-4 h-4" />
          Pool total CB must be non-negative and have at least 2 members
        </p>
      )}
    </div>
  );
}

export default App;