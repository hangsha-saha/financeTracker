import { TestBed } from '@angular/core/testing';

import { ViewBillsService } from './view-bills.service';

describe('ViewBillsService', () => {
  let service: ViewBillsService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(ViewBillsService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
