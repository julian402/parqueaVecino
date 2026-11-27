import { Controller, Get, HttpStatus, Patch, Post } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import {
  adminDocumentListQuerySchema,
  adminDocumentPageSchema,
  adminDocumentReviewSchema,
  adminDocumentSchema,
  documentSubmitSchema,
  documentUploadRequestSchema,
  documentUploadTicketSchema,
  fileLinkSchema,
  lotDocumentSchema,
  partnerLotDocumentsSchema,
  UserRole,
  type AdminDocument,
  type AdminDocumentListQuery,
  type AdminDocumentPage,
  type AdminDocumentReviewInput,
  type DocumentSubmitInput,
  type DocumentUploadRequest,
  type DocumentUploadTicket,
  type FileLink,
  type LotDocument,
  type PartnerLotDocuments,
} from '@parqueavecino/contracts';
import { ApiZodResponse, UuidParam, ZodBody, ZodQuery } from '../../../common/validation/zod';
import {
  CurrentUser,
  Roles,
  type AuthenticatedUser,
} from '../../auth/presentation/auth.decorators';
import { VerificationService } from '../application/verification.service';

/** Documentos de verificación de cada parqueadero del aliado (póliza RC, RUT, facturación). */
@ApiTags('partner')
@Roles(UserRole.PARTNER)
@Controller('partner/parking-lots/:lotId/documents')
export class PartnerDocumentsController {
  constructor(private readonly verification: VerificationService) {}

  @Get()
  @ApiZodResponse(partnerLotDocumentsSchema)
  list(
    @CurrentUser() user: AuthenticatedUser,
    @UuidParam('lotId') lotId: string,
  ): Promise<PartnerLotDocuments> {
    return this.verification.listForPartner(user.id, lotId);
  }

  @Post('upload-url')
  @ApiZodResponse(documentUploadTicketSchema, HttpStatus.CREATED)
  uploadUrl(
    @CurrentUser() user: AuthenticatedUser,
    @UuidParam('lotId') lotId: string,
    @ZodBody(documentUploadRequestSchema) input: DocumentUploadRequest,
  ): Promise<DocumentUploadTicket> {
    return this.verification.createUploadTicket(user.id, lotId, input);
  }

  @Post()
  @ApiZodResponse(lotDocumentSchema, HttpStatus.CREATED)
  submit(
    @CurrentUser() user: AuthenticatedUser,
    @UuidParam('lotId') lotId: string,
    @ZodBody(documentSubmitSchema) input: DocumentSubmitInput,
  ): Promise<LotDocument> {
    return this.verification.submit(user.id, lotId, input);
  }

  @Get(':id/file')
  @ApiZodResponse(fileLinkSchema)
  file(
    @CurrentUser() user: AuthenticatedUser,
    @UuidParam('lotId') lotId: string,
    @UuidParam('id') id: string,
  ): Promise<FileLink> {
    return this.verification.partnerFileLink(user.id, lotId, id);
  }
}

/** Cola de revisión de documentos del admin. */
@ApiTags('admin')
@Roles(UserRole.ADMIN)
@Controller('admin/documents')
export class AdminDocumentsController {
  constructor(private readonly verification: VerificationService) {}

  @Get()
  @ApiZodResponse(adminDocumentPageSchema)
  list(
    @ZodQuery(adminDocumentListQuerySchema) query: AdminDocumentListQuery,
  ): Promise<AdminDocumentPage> {
    return this.verification.listForAdmin(query);
  }

  @Patch(':id/review')
  @ApiZodResponse(adminDocumentSchema)
  review(
    @UuidParam('id') id: string,
    @ZodBody(adminDocumentReviewSchema) input: AdminDocumentReviewInput,
  ): Promise<AdminDocument> {
    return this.verification.review(id, input);
  }

  @Get(':id/file')
  @ApiZodResponse(fileLinkSchema)
  file(@UuidParam('id') id: string): Promise<FileLink> {
    return this.verification.adminFileLink(id);
  }
}
