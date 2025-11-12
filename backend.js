// ============================================
// BACKEND API IMPLEMENTATION SAMPLE
// ============================================

// ----- DOMAIN LAYER -----
// core/domain/entities/Route.ts

export enum VesselType {
  CONTAINER = 'Container',
  BULK_CARRIER = 'BulkCarrier',
  TANKER = 'Tanker',
  RORO = 'RoRo'
}

export enum FuelType {
  HFO = 'HFO',
  LNG = 'LNG',
  MGO = 'MGO'
}

export class ValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ValidationError';
  }
}

export interface RouteProps {
  id: string;
  routeId: string;
  vesselType: VesselType;
  fuelType: FuelType;
  year: number;
  ghgIntensity: number;
  fuelConsumption: number;
  distance: number;
  isBaseline: boolean;
}

export class Route {
  private constructor(
    public readonly id: string,
    public readonly routeId: string,
    public readonly vesselType: VesselType,
    public readonly fuelType: FuelType,
    public readonly year: number,
    public readonly ghgIntensity: number,
    public readonly fuelConsumption: number,
    public readonly distance: number,
    public readonly isBaseline: boolean
  ) {
    this.validate();
  }

  private validate(): void {
    if (this.ghgIntensity <= 0) {
      throw new ValidationError('GHG intensity must be positive');
    }
    if (this.fuelConsumption <= 0) {
      throw new ValidationError('Fuel consumption must be positive');
    }
    if (this.year < 2024) {
      throw new ValidationError('Year must be 2024 or later');
    }
  }

  static create(props: RouteProps): Route {
    return new Route(
      props.id,
      props.routeId,
      props.vesselType,
      props.fuelType,
      props.year,
      props.ghgIntensity,
      props.fuelConsumption,
      props.distance,
      props.isBaseline
    );
  }

  calculateEnergyInScope(): number {
    // Energy content: 41,000 MJ per tonne of fuel
    return this.fuelConsumption * 41000;
  }

  calculateTotalEmissions(): number {
    // Simplified calculation based on fuel type
    const emissionFactors: Record<FuelType, number> = {
      [FuelType.HFO]: 3.114, // tCO2/tonne fuel
      [FuelType.LNG]: 2.750,
      [FuelType.MGO]: 3.206
    };
    return this.fuelConsumption * emissionFactors[this.fuelType];
  }
}

// ----- VALUE OBJECTS -----
// core/domain/valueObjects/ComplianceBalance.ts

export class ComplianceBalance {
  constructor(
    public readonly value: number,
    public readonly year: number,
    public readonly shipId: string
  ) {}

  isSurplus(): boolean {
    return this.value > 0;
  }

  isDeficit(): boolean {
    return this.value < 0;
  }

  add(amount: number): ComplianceBalance {
    return new ComplianceBalance(
      this.value + amount,
      this.year,
      this.shipId
    );
  }

  subtract(amount: number): ComplianceBalance {
    return new ComplianceBalance(
      this.value - amount,
      this.year,
      this.shipId
    );
  }
}

// ----- PORTS (INTERFACES) -----
// core/ports/outbound/IRouteRepository.ts

export interface RouteFilters {
  vesselType?: VesselType;
  fuelType?: FuelType;
  year?: number;
}

export interface IRouteRepository {
  findAll(filters?: RouteFilters): Promise<Route[]>;
  findById(id: string): Promise<Route | null>;
  findByRouteId(routeId: string): Promise<Route | null>;
  findBaseline(): Promise<Route | null>;
  setBaseline(routeId: string): Promise<void>;
  save(route: Route): Promise<void>;
}

// core/ports/outbound/IComplianceRepository.ts

export interface ComplianceRecord {
  id: string;
  shipId: string;
  year: number;
  cbGco2eq: number;
  routeId?: string;
  createdAt: Date;
}

export interface IComplianceRepository {
  save(record: Omit<ComplianceRecord, 'id' | 'createdAt'>): Promise<ComplianceRecord>;
  findByShipAndYear(shipId: string, year: number): Promise<ComplianceRecord | null>;
  findAdjustedCB(shipId: string, year: number): Promise<number>;
}

// ----- APPLICATION LAYER - USE CASES -----
// core/application/useCases/ComputeCBUseCase.ts

export interface ComputeCBCommand {
  routeId: string;
  shipId: string;
  year: number;
}

export class ComputeCBUseCase {
  constructor(
    private routeRepo: IRouteRepository,
    private complianceRepo: IComplianceRepository
  ) {}

  async execute(command: ComputeCBCommand): Promise<ComplianceBalance> {
    const route = await this.routeRepo.findByRouteId(command.routeId);
    
    if (!route) {
      throw new Error('Route not found');
    }

    const targetIntensity = this.getTargetIntensity(command.year);
    const energyInScope = route.calculateEnergyInScope();
    
    // Compliance Balance Formula (EU Regulation Annex IV)
    // CB = (Target GHG Intensity - Actual GHG Intensity) × Energy in scope / 10^6
    const cbValue = ((targetIntensity - route.ghgIntensity) * energyInScope) / 1_000_000;
    
    // Save to database
    await this.complianceRepo.save({
      shipId: command.shipId,
      year: command.year,
      cbGco2eq: cbValue,
      routeId: route.routeId
    });

    return new ComplianceBalance(cbValue, command.year, command.shipId);
  }

  private getTargetIntensity(year: number): number {
    // Target intensity based on EU regulation
    // 2025: 2% reduction from baseline 91.16 gCO2e/MJ
    const baseline = 91.16;
    const reductionRates: Record<number, number> = {
      2025: 2,
      2030: 6,
      2035: 14.5,
      2040: 31,
      2045: 62,
      2050: 80
    };
    
    const reductionPercent = reductionRates[year] || 2;
    return baseline * (1 - reductionPercent / 100);
  }
}

// core/application/useCases/CompareRoutesUseCase.ts

export interface ComparisonResult {
  baseline: {
    routeId: string;
    ghgIntensity: number;
  };
  comparisons: Array<{
    routeId: string;
    ghgIntensity: number;
    percentDiff: number;
    compliant: boolean;
  }>;
  target: number;
}

export class CompareRoutesUseCase {
  constructor(private routeRepo: IRouteRepository) {}

  async execute(): Promise<ComparisonResult> {
    const baseline = await this.routeRepo.findBaseline();
    
    if (!baseline) {
      throw new Error('No baseline route set');
    }

    const allRoutes = await this.routeRepo.findAll();
    const target = 89.3368; // 2% below 91.16

    const comparisons = allRoutes
      .filter(r => r.routeId !== baseline.routeId)
      .map(route => {
        const percentDiff = ((route.ghgIntensity / baseline.ghgIntensity) - 1) * 100;
        const compliant = route.ghgIntensity <= target;

        return {
          routeId: route.routeId,
          ghgIntensity: route.ghgIntensity,
          percentDiff,
          compliant
        };
      });

    return {
      baseline: {
        routeId: baseline.routeId,
        ghgIntensity: baseline.ghgIntensity
      },
      comparisons,
      target
    };
  }
}

// core/application/useCases/BankSurplusUseCase.ts

export interface BankSurplusCommand {
  shipId: string;
  year: number;
  amount: number;
}

export interface IBankRepository {
  create(entry: { shipId: string; year: number; amountGco2eq: number }): Promise<void>;
  getTotalBanked(shipId: string, year: number): Promise<number>;
  applyBanked(shipId: string, year: number, amount: number): Promise<void>;
}

export class BankSurplusUseCase {
  constructor(
    private complianceRepo: IComplianceRepository,
    private bankRepo: IBankRepository
  ) {}

  async execute(command: BankSurplusCommand): Promise<void> {
    const cbRecord = await this.complianceRepo.findByShipAndYear(
      command.shipId,
      command.year
    );

    if (!cbRecord) {
      throw new Error('Compliance balance not found');
    }

    if (cbRecord.cbGco2eq <= 0) {
      throw new ValidationError('Cannot bank negative or zero CB');
    }

    if (command.amount > cbRecord.cbGco2eq) {
      throw new ValidationError('Amount exceeds available CB');
    }

    await this.bankRepo.create({
      shipId: command.shipId,
      year: command.year,
      amountGco2eq: command.amount
    });
  }
}

// core/application/useCases/CreatePoolUseCase.ts

export interface PoolMemberInput {
  shipId: string;
  cbBefore: number;
}

export interface PoolAllocation {
  shipId: string;
  cbBefore: number;
  cbAfter: number;
}

export interface CreatePoolCommand {
  year: number;
  members: PoolMemberInput[];
}

export interface IPoolRepository {
  create(pool: { year: number; members: PoolAllocation[] }): Promise<string>;
}

export class CreatePoolUseCase {
  constructor(private poolRepo: IPoolRepository) {}

  async execute(command: CreatePoolCommand): Promise<{
    poolId: string;
    allocations: PoolAllocation[];
  }> {
    // Validate minimum members
    if (command.members.length < 2) {
      throw new ValidationError('Pool must have at least 2 members');
    }

    // Validate total CB >= 0
    const totalCB = command.members.reduce((sum, m) => sum + m.cbBefore, 0);
    
    if (totalCB < 0) {
      throw new ValidationError('Pool total CB must be non-negative');
    }

    // Perform greedy allocation
    const allocations = this.greedyAllocate(command.members);
    
    // Validate pooling rules
    this.validatePoolingRules(command.members, allocations);
    
    // Create pool in database
    const poolId = await this.poolRepo.create({
      year: command.year,
      members: allocations
    });

    return { poolId, allocations };
  }

  private greedyAllocate(members: PoolMemberInput[]): PoolAllocation[] {
    // Sort by CB descending (surplus first)
    const sorted = [...members].sort((a, b) => b.cbBefore - a.cbBefore);
    
    const allocations: PoolAllocation[] = sorted.map(m => ({
      shipId: m.shipId,
      cbBefore: m.cbBefore,
      cbAfter: m.cbBefore
    }));

    // Transfer surplus to deficits
    for (let i = 0; i < allocations.length; i++) {
      if (allocations[i].cbAfter > 0) {
        // Ship has surplus
        for (let j = allocations.length - 1; j >= 0; j--) {
          if (allocations[j].cbAfter < 0) {
            // Ship has deficit
            const transfer = Math.min(
              allocations[i].cbAfter,
              Math.abs(allocations[j].cbAfter)
            );
            
            allocations[i].cbAfter -= transfer;
            allocations[j].cbAfter += transfer;
            
            if (allocations[i].cbAfter === 0) break;
          }
        }
      }
    }

    return allocations;
  }

  private validatePoolingRules(
    original: PoolMemberInput[],
    allocated: PoolAllocation[]
  ): void {
    const originalMap = new Map(original.map(m => [m.shipId, m.cbBefore]));

    for (const alloc of allocated) {
      const before = originalMap.get(alloc.shipId)!;
      const after = alloc.cbAfter;

      // Rule: Deficit ship cannot exit worse
      if (before < 0 && after < before) {
        throw new ValidationError(
          `Ship ${alloc.shipId} would exit worse (${after} < ${before})`
        );
      }

      // Rule: Surplus ship cannot exit negative
      if (before > 0 && after < 0) {
        throw new ValidationError(
          `Ship ${alloc.shipId} would exit negative (${after})`
        );
      }
    }
  }
}

// ----- ADAPTER LAYER - HTTP CONTROLLERS -----
// adapters/inbound/http/controllers/RouteController.ts

export class RouteController {
  constructor(
    private getRoutesUseCase: { execute: (filters?: RouteFilters) => Promise<Route[]> },
    private setBaselineUseCase: { execute: (routeId: string) => Promise<void> },
    private compareRoutesUseCase: CompareRoutesUseCase
  ) {}

  async getAll(req: any, res: any): Promise<void> {
    try {
      const filters: RouteFilters = {
        vesselType: req.query.vesselType,
        fuelType: req.query.fuelType,
        year: req.query.year ? parseInt(req.query.year) : undefined
      };

      const routes = await this.getRoutesUseCase.execute(filters);
      
      res.json(routes.map(r => ({
        routeId: r.routeId,
        vesselType: r.vesselType,
        fuelType: r.fuelType,
        year: r.year,
        ghgIntensity: r.ghgIntensity,
        fuelConsumption: r.fuelConsumption,
        distance: r.distance,
        totalEmissions: r.calculateTotalEmissions(),
        isBaseline: r.isBaseline
      })));
    } catch (error) {
      res.status(500).json({ error: (error as Error).message });
    }
  }

  async setBaseline(req: any, res: any): Promise<void> {
    try {
      const { id } = req.params;
      await this.setBaselineUseCase.execute(id);
      res.json({ success: true, routeId: id });
    } catch (error) {
      res.status(400).json({ error: (error as Error).message });
    }
  }

  async getComparison(req: any, res: any): Promise<void> {
    try {
      const result = await this.compareRoutesUseCase.execute();
      res.json(result);
    } catch (error) {
      res.status(500).json({ error: (error as Error).message });
    }
  }
}

// ----- EXAMPLE EXPRESS ROUTES SETUP -----
// adapters/inbound/http/routes/index.ts

export function setupRoutes(app: any, controllers: any) {
  // Routes
  app.get('/routes', (req: any, res: any) => 
    controllers.route.getAll(req, res));
  app.post('/routes/:id/baseline', (req: any, res: any) => 
    controllers.route.setBaseline(req, res));
  app.get('/routes/comparison', (req: any, res: any) => 
    controllers.route.getComparison(req, res));

  // Compliance
  app.get('/compliance/cb', (req: any, res: any) => 
    controllers.compliance.getCB(req, res));
  app.get('/compliance/adjusted-cb', (req: any, res: any) => 
    controllers.compliance.getAdjustedCB(req, res));

  // Banking
  app.post('/banking/bank', (req: any, res: any) => 
    controllers.banking.bankSurplus(req, res));
  app.post('/banking/apply', (req: any, res: any) => 
    controllers.banking.applyBanked(req, res));

  // Pooling
  app.post('/pools', (req: any, res: any) => 
    controllers.pool.createPool(req, res));
}