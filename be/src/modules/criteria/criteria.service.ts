import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { randomUUID } from "node:crypto";
import { PrismaService } from "../../prisma/prisma.service.js";
import type { CreateCriterionDto } from "./dto/create-criterion.dto.js";
import type { UpdateCriterionDto } from "./dto/update-criterion.dto.js";

@Injectable()
export class CriteriaService {
  constructor(private readonly prisma: PrismaService) {}

  async findByPeriod(periodId: string) {
    const criteria = await this.prisma.criterion.findMany({
      where: { periodId },
      orderBy: { sortOrder: "asc" },
    });
    const nodes = criteria.map((criterion) => ({
      ...criterion,
      children: [] as typeof criteria,
    }));
    const nodesById = new Map(nodes.map((node) => [node.id, node]));
    const roots: typeof nodes = [];

    for (const node of nodes) {
      const parent = node.parentId ? nodesById.get(node.parentId) : undefined;
      if (parent) {
        parent.children.push(node);
      } else {
        roots.push(node);
      }
    }
    return roots;
  }

  async findOne(id: string) {
    const criterion = await this.prisma.criterion.findUnique({
      where: { id },
      include: { parent: true, children: { orderBy: { sortOrder: "asc" } } },
    });
    if (!criterion) {
      throw new NotFoundException(`Criterion ${id} was not found`);
    }
    return criterion;
  }

  create(dto: CreateCriterionDto) {
    const now = new Date();
    return this.prisma.criterion.create({
      data: {
        id: randomUUID(),
        periodId: dto.periodId,
        parentId: dto.parentId ?? null,
        code: dto.code,
        name: dto.name,
        description: dto.description ?? null,
        maxScore: dto.maxScore,
        evidenceRequirement: dto.evidenceRequirement ?? null,
        allowText: dto.allowText ?? true,
        allowFile: dto.allowFile ?? true,
        allowLink: dto.allowLink ?? true,
        evidenceRequired: dto.evidenceRequired ?? true,
        sortOrder: dto.sortOrder,
        createdAt: now,
        updatedAt: now,
      },
    });
  }

  async update(id: string, dto: UpdateCriterionDto) {
    await this.findOne(id);
    return this.prisma.criterion.update({
      where: { id },
      data: { ...dto, updatedAt: new Date() },
    });
  }

  async remove(id: string) {
    const criterion = await this.prisma.criterion.findUnique({
      where: { id },
      select: {
        id: true,
        _count: { select: { children: true, scores: true } },
      },
    });
    if (!criterion) {
      throw new NotFoundException(`Criterion ${id} was not found`);
    }
    if (criterion._count.children > 0 || criterion._count.scores > 0) {
      throw new BadRequestException(
        "Cannot delete a criterion that has child criteria or criterion scores",
      );
    }
    return this.prisma.criterion.delete({ where: { id } });
  }
}
